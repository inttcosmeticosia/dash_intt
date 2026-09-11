// Flatten RPC results into SheetJS workbook sheets for all report types.
import * as XLSX from 'npm:xlsx@0.18.5';

export type SheetBundle = {
  workbook: XLSX.WorkBook;
  linhas: number;
  nomeArquivo: string;
};

type Json = Record<string, unknown>;

/** Normalize for case-/accent-insensitive column matching. */
function normalizeKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

/** Common aliases → canonical RPC field names. */
const ALIASES: Record<string, string> = {
  name: 'nome',
  phone: 'telefone',
  tel: 'telefone',
  celular: 'telefone',
  city: 'cidade',
  region: 'regiao',
  regio: 'regiao',
  tipo: 'tipo_cliente',
  type: 'tipo_cliente',
  cliente_tipo: 'tipo_cliente',
  country: 'pais',
  rep: 'representante',
  tel_representante: 'telefone_representante',
  telefone_rep: 'telefone_representante',
  phone_rep: 'telefone_representante',
  motivo: 'motivo_transferencia',
  reason: 'motivo_transferencia',
  summary: 'resumo',
  created_at: 'criada_em',
  data: 'criada_em',
  data_criacao: 'criada_em',
  last_message: 'ultima_mensagem_em',
  ultima_mensagem: 'ultima_mensagem_em',
  day: 'dia',
  week: 'semana',
  new: 'novos',
  active: 'ativos',
  transferred: 'transferidos',
  message: 'mensagem',
  msg: 'mensagem',
  tel_mencionado: 'telefone_mencionado',
  telefone_menc: 'telefone_mencionado',
};

function canonical(key: string): string {
  const n = normalizeKey(key);
  return ALIASES[n] ?? n;
}

/**
 * Parse optional `colunas` body param.
 * Omitted / empty / [] → null (all columns).
 * Accepts string[], JSON string, or comma-separated string.
 */
export function parseColunas(raw: unknown): string[] | null {
  if (raw == null) return null;

  if (Array.isArray(raw)) {
    const list = raw
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter(Boolean);
    return list.length > 0 ? list : null;
  }

  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t || t === '[]' || t.toLowerCase() === 'null') return null;
    try {
      return parseColunas(JSON.parse(t));
    } catch {
      const list = t.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      return list.length > 0 ? list : null;
    }
  }

  return null;
}

/** Drop conv_key from every sheet row (internal ID — never expose in Excel). */
function stripConvKey(rows: Json[]): Json[] {
  return rows
    .filter((row) => row.chave !== 'conv_key') // kvRows shape
    .map(({ conv_key: _omit, ...rest }) => rest);
}

function isKvShape(row: Json): boolean {
  return (
    Object.prototype.hasOwnProperty.call(row, 'chave') &&
    Object.prototype.hasOwnProperty.call(row, 'valor')
  );
}

/** Keep only requested columns (case/alias-insensitive). Order follows `colunas`. */
function filterColumns(rows: Json[], colunas: string[] | null): Json[] {
  if (!colunas || colunas.length === 0) return rows;

  const wanted = colunas.map(canonical);

  // KPI / kv sheets: filter by chave
  if (rows.length > 0 && rows.every(isKvShape)) {
    const matched = rows.filter((row) =>
      wanted.includes(canonical(String(row.chave ?? '')))
    );
    return matched.length > 0
      ? matched
      : wanted.map((w) => ({ chave: w, valor: '' }));
  }

  return rows.map((row) => {
    const keys = Object.keys(row);
    const out: Json = {};
    for (let i = 0; i < wanted.length; i++) {
      const w = wanted[i];
      const match = keys.find((k) => canonical(k) === w);
      if (match !== undefined) {
        out[match] = row[match];
      } else {
        // Keep requested header even if RPC row lacks the field
        out[colunas[i]] = '';
      }
    }
    return out;
  });
}

function asRows(data: unknown): Json[] {
  if (Array.isArray(data)) {
    return data.map((row) =>
      row && typeof row === 'object' && !Array.isArray(row)
        ? (row as Json)
        : { valor: row }
    );
  }
  return [];
}

function kvRows(obj: unknown): Json[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  return Object.entries(obj as Json).map(([chave, valor]) => ({
    chave,
    valor: valor === null || valor === undefined
      ? ''
      : typeof valor === 'object'
      ? JSON.stringify(valor)
      : valor,
  }));
}

function addSheet(
  wb: XLSX.WorkBook,
  name: string,
  rows: Json[],
  colunas: string[] | null = null
): number {
  const safe = name.slice(0, 31);
  const cleaned = filterColumns(stripConvKey(rows), colunas);
  const data = cleaned.length > 0 ? cleaned : [{ _: '' }];
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, safe);
  return cleaned.length;
}

function periodSuffix(params: Json): string {
  const inicio = typeof params.p_inicio === 'string' ? params.p_inicio : 'sem_inicio';
  const fim = typeof params.p_fim === 'string' ? params.p_fim : 'sem_fim';
  return `${inicio}_${fim}`;
}

function fileName(tipo: string, params: Json): string {
  return `${tipo}_${periodSuffix(params)}.xlsx`;
}

export function buildWorkbook(
  tipo: string,
  dados: unknown,
  params: Json,
  colunas: string[] | null = null
): SheetBundle {
  const wb = XLSX.utils.book_new();
  let linhas = 0;

  switch (tipo) {
    case 'metricas_atendimento': {
      const m = (dados ?? {}) as Json;
      const { periodo_anterior, ...atuais } = m;
      linhas += addSheet(wb, 'KPIs', kvRows(atuais), colunas);
      linhas += addSheet(
        wb,
        'periodo_anterior',
        kvRows(periodo_anterior && typeof periodo_anterior === 'object' ? periodo_anterior : {}),
        colunas
      );
      break;
    }

    case 'atendimentos_diarios':
    case 'atendimentos_semanais':
    case 'relatorio_handoffs':
    case 'relatorio_transferencias_ramon':
    case 'handoffs_por_representante':
    case 'agente_buscar_conversas':
    case 'agente_resumos_periodo':
    case 'agente_buscar_mensagens':
    case 'agente_produtos_mencionados': {
      linhas += addSheet(wb, 'dados', asRows(dados), colunas);
      break;
    }

    case 'relatorio_internacional': {
      const r = (dados ?? {}) as Json;
      linhas += addSheet(wb, 'por_pais', asRows(r.por_pais), colunas);
      linhas += addSheet(wb, 'conversas', asRows(r.conversas), colunas);
      // total as tiny KPI sheet for empty-safe always-generate
      linhas += addSheet(wb, 'resumo', kvRows({ total: r.total ?? 0 }), colunas);
      break;
    }

    case 'agente_detalhe_conversa': {
      const d = (dados ?? {}) as Json;
      linhas += addSheet(wb, 'conversa', kvRows(d.conversa ?? d), colunas);
      linhas += addSheet(wb, 'mensagens', asRows(d.mensagens_recebidas), colunas);
      break;
    }

    case 'agente_estatisticas_perfil': {
      const e = (dados ?? {}) as Json;
      linhas += addSheet(
        wb,
        'resumo',
        kvRows({
          total_conversas: e.total_conversas ?? 0,
          transferidas: e.transferidas ?? 0,
        }),
        colunas
      );
      linhas += addSheet(wb, 'por_tipo_cliente', asRows(e.por_tipo_cliente), colunas);
      linhas += addSheet(wb, 'por_regiao', asRows(e.por_regiao), colunas);
      linhas += addSheet(wb, 'por_pais', asRows(e.por_pais), colunas);
      linhas += addSheet(wb, 'por_motivo', asRows(e.por_motivo_transferencia), colunas);
      break;
    }

    default:
      throw new Error(`tipo desconhecido: ${tipo}`);
  }

  // Guarantee at least one sheet even if switch somehow empty
  if (wb.SheetNames.length === 0) {
    linhas += addSheet(wb, 'dados', [], colunas);
  }

  return {
    workbook: wb,
    linhas,
    nomeArquivo: fileName(tipo, params),
  };
}

export function workbookToBytes(wb: XLSX.WorkBook): Uint8Array {
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[];
  return new Uint8Array(out);
}
