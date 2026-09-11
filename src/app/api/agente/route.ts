import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AgenteMessage, AgenteResponse } from '@/services/agente';

export const maxDuration = 120;

const WEBHOOK_TIMEOUT_MS = 120_000;
const MAX_UNWRAP_DEPTH = 8;

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const whole = trimmed.match(/^```(?:json|javascript|js)?\s*\r?\n?([\s\S]*?)\r?\n?```$/i);
  if (whole) return whole[1].trim();

  const embedded = trimmed.match(/```(?:json|javascript|js)?\s*\r?\n?([\s\S]*?)\r?\n?```/i);
  if (embedded) return embedded[1].trim();

  return trimmed;
}

function extractJsonObject(text: string): unknown {
  const trimmed = stripMarkdownFences(text);
  try {
    return JSON.parse(trimmed);
  } catch {
    // Agent sometimes wraps JSON in prose — take the first balanced {...}
  }

  const start = trimmed.indexOf('{');
  if (start < 0) throw new Error('Resposta do agente sem JSON');

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return JSON.parse(trimmed.slice(start, i + 1));
      }
    }
  }
  throw new Error('JSON do agente incompleto');
}

function asTextMessage(text: string): AgenteResponse {
  return { messages: [{ kind: 'text', text }] };
}

function normalizeAgentePayload(raw: unknown, depth = 0): AgenteResponse {
  if (depth > MAX_UNWRAP_DEPTH) {
    throw new Error('Formato inválido (aninhamento demais)');
  }

  let value = raw;

  if (typeof value === 'string') {
    const stripped = stripMarkdownFences(value);
    if (!stripped) throw new Error('Resposta do agente vazia');
    try {
      value = extractJsonObject(stripped);
    } catch {
      // Plain-language agent reply (common when last node is the Agent itself)
      return asTextMessage(stripped);
    }
  }

  if (Array.isArray(value)) {
    if (value.length === 0) throw new Error('Resposta do agente vazia');
    let lastErr: Error | null = null;
    for (const item of value) {
      try {
        return normalizeAgentePayload(item, depth + 1);
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
      }
    }
    throw lastErr ?? new Error('Formato de resposta do agente inválido');
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    if (Array.isArray(obj.messages)) {
      return {
        messages: obj.messages as AgenteMessage[],
        metadata: (obj.metadata as Record<string, unknown>) ?? undefined,
      };
    }

    // n8n item shape: { json: {...} }
    if (obj.json != null && typeof obj.json === 'object') {
      try {
        return normalizeAgentePayload(obj.json, depth + 1);
      } catch {
        // fall through to other wrappers
      }
    }

    // Common n8n / LangChain Agent wrappers
    for (const key of ['output', 'text', 'response', 'data', 'result', 'message'] as const) {
      const nested = obj[key];
      if (typeof nested === 'string') {
        return normalizeAgentePayload(nested, depth + 1);
      }
      if (nested && typeof nested === 'object') {
        try {
          return normalizeAgentePayload(nested, depth + 1);
        } catch {
          // try next key
        }
      }
    }
  }

  throw new Error(
    'Formato inválido — webhook deve devolver { messages, metadata } (ou output JSON com esse shape)'
  );
}

function clientSafeReason(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const msg = err.message.replace(/\s+/g, ' ').trim();
  if (!msg) return fallback;
  // Avoid leaking URLs / tokens that might appear in unexpected Error messages
  if (/https?:\/\//i.test(msg) || /bearer|apikey|service_role|secret/i.test(msg)) {
    return fallback;
  }
  return msg.length > 180 ? `${msg.slice(0, 177)}...` : msg;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const webhookUrl = process.env.N8N_AGENTE_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'N8N_AGENTE_WEBHOOK_URL não configurada' },
      { status: 500 }
    );
  }

  let body: { message?: unknown; conversationId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json({ error: 'message é obrigatório' }, { status: 400 });
  }

  const conversationId =
    typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
  // UUID-ish ids only — avoid injecting arbitrary session suffixes
  const safeConversationId =
    conversationId && /^[0-9a-f-]{8,64}$/i.test(conversationId) ? conversationId : '';
  const session = safeConversationId
    ? `dash:${user.id}:${safeConversationId}`
    : `dash:${user.id}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const secret = process.env.N8N_AGENTE_WEBHOOK_SECRET?.trim();
  if (secret) {
    headers['X-Agente-Secret'] = secret;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const upstream = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, session }),
      signal: controller.signal,
    });

    const contentType = upstream.headers.get('content-type') ?? '';
    const rawText = await upstream.text();

    if (!upstream.ok) {
      console.error('n8n agente webhook error', upstream.status, rawText.slice(0, 500));
      const hint =
        upstream.status === 401 || upstream.status === 403
          ? ' (não autorizado — confira URL/secret do webhook)'
          : upstream.status === 404
            ? ' (webhook não encontrado — confira N8N_AGENTE_WEBHOOK_URL)'
            : '';
      return NextResponse.json(
        { error: `Falha ao consultar o agente (HTTP ${upstream.status})${hint}` },
        { status: 502 }
      );
    }

    if (!rawText.trim()) {
      return NextResponse.json(
        {
          error:
            'Webhook n8n retornou corpo vazio. Use Response Mode "When Last Node Finishes" (ou Respond to Webhook) com JSON { messages, metadata }. Não use callback HTTP "enviar resposta".',
        },
        { status: 502 }
      );
    }

    let parsed: unknown = rawText;
    if (
      contentType.includes('application/json') ||
      rawText.trim().startsWith('{') ||
      rawText.trim().startsWith('[') ||
      rawText.trim().startsWith('`')
    ) {
      try {
        parsed = JSON.parse(stripMarkdownFences(rawText));
      } catch {
        parsed = rawText;
      }
    }

    let payload: AgenteResponse;
    try {
      payload = normalizeAgentePayload(parsed);
    } catch (parseErr) {
      console.error(
        'n8n agente parse error',
        clientSafeReason(parseErr, 'parse'),
        rawText.slice(0, 400)
      );
      return NextResponse.json(
        {
          error: `Resposta do agente ilegível: ${clientSafeReason(
            parseErr,
            'formato inválido'
          )}`,
        },
        { status: 502 }
      );
    }

    if (!payload.messages?.length) {
      return NextResponse.json(
        { error: 'Agente retornou resposta vazia (messages[])' },
        { status: 502 }
      );
    }

    return NextResponse.json(payload);
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    console.error('n8n agente proxy error', err);
    return NextResponse.json(
      {
        error: aborted
          ? 'Tempo esgotado aguardando o agente (~120s)'
          : `Erro ao consultar o agente: ${clientSafeReason(err, 'falha de rede/proxy')}`,
      },
      { status: aborted ? 504 : 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}
