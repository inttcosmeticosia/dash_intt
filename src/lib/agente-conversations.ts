import type { AgenteMessage } from '@/services/agente';
import { createClient } from '@/lib/supabase/client';

export type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; messages: AgenteMessage[] }
  | { role: 'error'; text: string };

export type AgenteConversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
};

const STORAGE_PREFIX = 'intt-agente-conversations:';
const TITLE_MAX = 40;
export const DEFAULT_CONVERSATION_TITLE = 'Nova conversa';

export function conversationsStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function createConversation(): AgenteConversation {
  return {
    id: crypto.randomUUID(),
    title: DEFAULT_CONVERSATION_TITLE,
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

export function titleFromFirstMessage(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return DEFAULT_CONVERSATION_TITLE;
  if (cleaned.length <= TITLE_MAX) return cleaned;
  return `${cleaned.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

/** Backfill title from first user message when still the default. */
export function withDerivedTitle(c: AgenteConversation): AgenteConversation {
  if (c.title !== DEFAULT_CONVERSATION_TITLE) return c;
  const first = c.messages.find((m) => m.role === 'user');
  if (!first || first.role !== 'user') return c;
  const title = titleFromFirstMessage(first.text);
  return title === DEFAULT_CONVERSATION_TITLE ? c : { ...c, title };
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  if (m.role === 'user' || m.role === 'error') {
    return typeof m.text === 'string';
  }
  if (m.role === 'assistant') {
    return Array.isArray(m.messages);
  }
  return false;
}

function isConversation(value: unknown): value is AgenteConversation {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.title === 'string' &&
    typeof c.updatedAt === 'string' &&
    Array.isArray(c.messages) &&
    c.messages.every(isChatMessage)
  );
}

function parseConversations(raw: unknown): AgenteConversation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isConversation)
    .map(withDerivedTitle)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Prefer the richer / newer copy of each conversation id. */
export function mergeConversationLists(
  a: AgenteConversation[],
  b: AgenteConversation[]
): AgenteConversation[] {
  const merged = new Map<string, AgenteConversation>();
  for (const c of [...a, ...b]) {
    const existing = merged.get(c.id);
    if (!existing) {
      merged.set(c.id, withDerivedTitle(c));
      continue;
    }
    if (c.messages.length > existing.messages.length) {
      merged.set(c.id, withDerivedTitle(c));
    } else if (
      c.messages.length === existing.messages.length &&
      c.updatedAt > existing.updatedAt
    ) {
      merged.set(c.id, withDerivedTitle(c));
    }
  }
  return [...merged.values()].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
}

export function loadConversations(userId: string): AgenteConversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = conversationsStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) {
      // #region agent log
      fetch('http://127.0.0.1:7617/ingest/48344d34-49d3-4296-a2de-2c9892396c64',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7e6ed1'},body:JSON.stringify({sessionId:'7e6ed1',runId:'post-fix',hypothesisId:'A',location:'agente-conversations.ts:load',message:'load empty — no localStorage key',data:{backend:'localStorage',hadKey:false,userIdSuffix:userId.slice(-6),keyPrefix:STORAGE_PREFIX},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return [];
    }
    const list = parseConversations(JSON.parse(raw) as unknown);
    // #region agent log
    fetch('http://127.0.0.1:7617/ingest/48344d34-49d3-4296-a2de-2c9892396c64',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7e6ed1'},body:JSON.stringify({sessionId:'7e6ed1',runId:'post-fix',hypothesisId:'A',location:'agente-conversations.ts:load',message:'load from localStorage cache',data:{backend:'localStorage',hadKey:true,count:list.length,withMsgs:list.filter((c)=>c.messages.length>0).length,userIdSuffix:userId.slice(-6)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return list;
  } catch {
    // #region agent log
    fetch('http://127.0.0.1:7617/ingest/48344d34-49d3-4296-a2de-2c9892396c64',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7e6ed1'},body:JSON.stringify({sessionId:'7e6ed1',runId:'post-fix',hypothesisId:'C',location:'agente-conversations.ts:load',message:'load threw',data:{backend:'localStorage'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return [];
  }
}

export function saveConversations(userId: string, conversations: AgenteConversation[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(conversationsStorageKey(userId), JSON.stringify(conversations));
    // #region agent log
    fetch('http://127.0.0.1:7617/ingest/48344d34-49d3-4296-a2de-2c9892396c64',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7e6ed1'},body:JSON.stringify({sessionId:'7e6ed1',runId:'post-fix',hypothesisId:'D',location:'agente-conversations.ts:save',message:'save localStorage cache',data:{backend:'localStorage',count:conversations.length,withMsgs:conversations.filter((c)=>c.messages.length>0).length,userIdSuffix:userId.slice(-6)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  } catch {
    // #region agent log
    fetch('http://127.0.0.1:7617/ingest/48344d34-49d3-4296-a2de-2c9892396c64',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7e6ed1'},body:JSON.stringify({sessionId:'7e6ed1',runId:'post-fix',hypothesisId:'D',location:'agente-conversations.ts:save',message:'save failed (quota/private)',data:{backend:'localStorage',count:conversations.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }
}

export async function fetchRemoteConversations(userId: string): Promise<AgenteConversation[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('dashboard_agente_conversations')
    .select('conversations')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    // #region agent log
    fetch('http://127.0.0.1:7617/ingest/48344d34-49d3-4296-a2de-2c9892396c64',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7e6ed1'},body:JSON.stringify({sessionId:'7e6ed1',runId:'post-fix',hypothesisId:'E',location:'agente-conversations.ts:fetchRemote',message:'remote load error',data:{backend:'supabase',code:error.code,userIdSuffix:userId.slice(-6)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw error;
  }

  const list = parseConversations(data?.conversations ?? []);
  // #region agent log
  fetch('http://127.0.0.1:7617/ingest/48344d34-49d3-4296-a2de-2c9892396c64',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7e6ed1'},body:JSON.stringify({sessionId:'7e6ed1',runId:'post-fix',hypothesisId:'E',location:'agente-conversations.ts:fetchRemote',message:'remote load ok',data:{backend:'supabase',hadRow:!!data,count:list.length,withMsgs:list.filter((c)=>c.messages.length>0).length,userIdSuffix:userId.slice(-6)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return list;
}

export async function persistRemoteConversations(
  userId: string,
  conversations: AgenteConversation[]
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('dashboard_agente_conversations').upsert(
    {
      user_id: userId,
      conversations,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  // #region agent log
  fetch('http://127.0.0.1:7617/ingest/48344d34-49d3-4296-a2de-2c9892396c64',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7e6ed1'},body:JSON.stringify({sessionId:'7e6ed1',runId:'post-fix',hypothesisId:'E',location:'agente-conversations.ts:persistRemote',message:error?'remote save error':'remote save ok',data:{backend:'supabase',ok:!error,code:error?.code??null,count:conversations.length,withMsgs:conversations.filter((c)=>c.messages.length>0).length,userIdSuffix:userId.slice(-6)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (error) throw error;
}
