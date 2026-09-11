import type { AgenteMessage } from '@/services/agente';

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

export function loadConversations(userId: string): AgenteConversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(conversationsStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isConversation)
      .map(withDerivedTitle)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function saveConversations(userId: string, conversations: AgenteConversation[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(conversationsStorageKey(userId), JSON.stringify(conversations));
  } catch {
    // Quota / private mode — ignore; in-memory state still works for the session
  }
}
