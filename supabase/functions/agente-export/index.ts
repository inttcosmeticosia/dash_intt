// ════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: agente-export
// ════════════════════════════════════════════════════════════════════════════
// Calls existing analytics RPCs via service_role, builds .xlsx, uploads to
// private bucket agent-exports, returns { dados, planilha: { url, ... } }.
// Never alters Postgres RPC signatures.
// ════════════════════════════════════════════════════════════════════════════

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildWorkbook, parseColunas, workbookToBytes } from './sheets.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const SIGNED_TTL_SECONDS = 60 * 60 * 24; // 24h
const BUCKET = 'agent-exports';

/** tipo → RPC name (same) + which body keys to forward as RPC args */
const TIPOS: Record<string, { rpc: string; params: string[] }> = {
  metricas_atendimento: { rpc: 'metricas_atendimento', params: ['p_inicio', 'p_fim'] },
  atendimentos_diarios: { rpc: 'atendimentos_diarios', params: ['p_inicio', 'p_fim'] },
  atendimentos_semanais: { rpc: 'atendimentos_semanais', params: ['p_inicio', 'p_fim'] },
  relatorio_handoffs: { rpc: 'relatorio_handoffs', params: ['p_inicio', 'p_fim'] },
  handoffs_por_representante: {
    rpc: 'handoffs_por_representante',
    params: ['p_inicio', 'p_fim'],
  },
  relatorio_internacional: { rpc: 'relatorio_internacional', params: ['p_inicio', 'p_fim'] },
  relatorio_transferencias_ramon: {
    rpc: 'relatorio_transferencias_ramon',
    params: ['p_inicio', 'p_fim'],
  },
  agente_buscar_conversas: {
    rpc: 'agente_buscar_conversas',
    params: [
      'p_busca',
      'p_inicio',
      'p_fim',
      'p_representante',
      'p_tipo_cliente',
      'p_pais',
      'p_apenas_transferidas',
      'p_limite',
    ],
  },
  agente_detalhe_conversa: {
    rpc: 'agente_detalhe_conversa',
    params: ['p_conv_key', 'p_telefone', 'p_max_mensagens'],
  },
  agente_resumos_periodo: {
    rpc: 'agente_resumos_periodo',
    params: ['p_inicio', 'p_fim', 'p_limite'],
  },
  agente_buscar_mensagens: {
    rpc: 'agente_buscar_mensagens',
    params: ['p_termo', 'p_inicio', 'p_fim', 'p_limite'],
  },
  agente_estatisticas_perfil: {
    rpc: 'agente_estatisticas_perfil',
    params: ['p_inicio', 'p_fim'],
  },
  agente_produtos_mencionados: {
    rpc: 'agente_produtos_mencionados',
    params: ['p_inicio', 'p_fim', 'p_incluir_categorias', 'p_limite'],
  },
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      Connection: 'keep-alive',
    },
  });
}

function bearerToken(req: Request): string | null {
  const h = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function pickParams(body: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

function storagePath(tipo: string, nomeArquivo: string): string {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const uuid = crypto.randomUUID();
  const base = nomeArquivo.replace(/\.xlsx$/i, '');
  return `${yyyy}/${mm}/${base}_${uuid}.xlsx`;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      });
    }

    if (req.method !== 'POST') {
      return json(405, { error: 'Use POST' });
    }

    // Only service_role may call (n8n tools). Gateway verify_jwt accepts any JWT —
    // we additionally require the exact service_role secret.
    const token = bearerToken(req);
    if (!token || token !== SERVICE_ROLE) {
      return json(401, { error: 'Unauthorized: service_role required' });
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return json(400, { error: 'Body JSON inválido' });
    }

    const tipo = typeof body.tipo === 'string' ? body.tipo.trim() : '';
    const cfg = TIPOS[tipo];
    if (!cfg) {
      return json(400, {
        error: `tipo inválido. Use um de: ${Object.keys(TIPOS).join(', ')}`,
      });
    }

    const rpcParams = pickParams(body, cfg.params);
    // Optional: restrict Excel columns only (JSON `dados` stays full RPC payload)
    const colunas = parseColunas(body.colunas);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: dados, error: rpcError } = await supabase.rpc(cfg.rpc, rpcParams);
    if (rpcError) {
      return json(500, { error: `RPC ${cfg.rpc}: ${rpcError.message}` });
    }

    const { workbook, linhas, nomeArquivo } = buildWorkbook(tipo, dados, rpcParams, colunas);

    // No rows worth exporting → return dados only (agent must not invent a download link)
    const arrayEmpty = Array.isArray(dados) && dados.length === 0;
    const intlEmpty =
      tipo === 'relatorio_internacional' &&
      !!dados &&
      typeof dados === 'object' &&
      !Array.isArray(dados) &&
      Number((dados as Record<string, unknown>).total ?? 0) === 0 &&
      (!Array.isArray((dados as Record<string, unknown>).conversas) ||
        ((dados as Record<string, unknown>).conversas as unknown[]).length === 0);

    if (linhas <= 0 || arrayEmpty || intlEmpty) {
      console.log(
        JSON.stringify({
          event: 'agente-export-skip-planilha',
          tipo,
          linhas,
          arrayEmpty,
          intlEmpty,
        })
      );
      return json(200, {
        dados,
        planilha: null,
        aviso: 'Sem linhas para exportar — planilha omitida.',
      });
    }

    const bytes = workbookToBytes(workbook);
    const path = storagePath(tipo, nomeArquivo);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        contentDisposition: `attachment; filename="${nomeArquivo}"`,
        upsert: false,
      });

    if (uploadError) {
      return json(500, { error: `Upload Storage: ${uploadError.message}` });
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      return json(500, { error: `Signed URL: ${signError?.message ?? 'falhou'}` });
    }

    const expira = new Date(Date.now() + SIGNED_TTL_SECONDS * 1000).toISOString();

    console.log(
      JSON.stringify({
        event: 'agente-export-ok',
        tipo,
        linhas,
        path,
      })
    );

    return json(200, {
      dados,
      planilha: {
        url: signed.signedUrl,
        nome_arquivo: nomeArquivo,
        linhas,
        expira_em: expira,
      },
    });
  } catch (e) {
    console.error('agente-export error:', e);
    return json(500, { error: String(e) });
  }
});
