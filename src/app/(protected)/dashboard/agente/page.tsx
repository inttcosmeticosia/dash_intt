'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowUp,
  BarChart3,
  Download,
  Loader2,
  MessageSquarePlus,
  MessagesSquare,
  Package,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  createConversation,
  DEFAULT_CONVERSATION_TITLE,
  fetchRemoteConversations,
  loadConversations,
  mergeConversationLists,
  persistRemoteConversations,
  saveConversations,
  titleFromFirstMessage,
  withDerivedTitle,
  type AgenteConversation,
  type ChatMessage,
} from '@/lib/agente-conversations';
import { formatAgenteTextToHtml } from '@/lib/agente-format';
import { enviarMensagemAgente, type AgenteMessage } from '@/services/agente';
import { getProfile } from '@/services/analytics';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  {
    label: 'Transferências',
    prompt: 'Quantos transferidos nos últimos 7 dias?',
    icon: Users,
  },
  {
    label: 'Ranking',
    prompt: 'Ranking de representantes no último mês',
    icon: BarChart3,
  },
  {
    label: 'Produtos citados',
    prompt: 'Quais produtos os clientes mais citaram nos últimos 30 dias?',
    icon: Package,
  },
] as const;

function saudacaoDoDia(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function primeiroNome(nome: string | null | undefined): string | null {
  const parte = nome?.trim().split(/\s+/)[0];
  return parte || null;
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return '';
  }
}

function Composer({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  disabled,
  inputRef,
  variant,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  variant: 'hero' | 'dock';
}) {
  const hero = variant === 'hero';

  return (
    <form onSubmit={onSubmit} className={cn(hero ? 'w-full' : 'shrink-0 px-4 pb-4 pt-2 sm:px-6')}>
      <div
        className={cn(
          'mx-auto flex w-full items-end gap-2',
          hero
            ? 'max-w-xl rounded-2xl border border-zinc-200/80 bg-white px-3 py-2.5 shadow-[0_8px_30px_rgba(130,24,28,0.08)] ring-1 ring-brand-100/60'
            : 'max-w-2xl rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-sm'
        )}
      >
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={hero ? 2 : 1}
          placeholder={
            hero
              ? 'Descreva o que precisa saber sobre atendimento…'
              : 'Pergunte sobre atendimento, transferências, produtos…'
          }
          disabled={disabled}
          className={cn(
            'min-h-[44px] max-h-36 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-zinc-900 placeholder:text-zinc-400',
            'focus:outline-none disabled:opacity-60',
            hero && 'min-h-[56px]'
          )}
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className={cn(
            'mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-all',
            'hover:bg-brand-700 hover:scale-[1.03] active:scale-95',
            'disabled:opacity-35 disabled:hover:scale-100'
          )}
          aria-label="Enviar"
        >
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          )}
        </button>
      </div>
    </form>
  );
}

function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  open,
  onClose,
  newDisabled,
}: {
  conversations: AgenteConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  open: boolean;
  onClose: () => void;
  /** Only blocks "Nova conversa" / delete — selecting another chat stays allowed. */
  newDisabled?: boolean;
}) {
  return (
    <>
      {/* Mobile overlay — md matches DashboardShell nav breakpoint */}
      <button
        type="button"
        aria-label="Fechar lista de chats"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-30 bg-zinc-900/40 transition-opacity md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

      <aside
        className={cn(
          'flex h-full w-[260px] shrink-0 flex-col border-r border-zinc-200/80 bg-white/95 backdrop-blur-sm',
          // Mobile: drawer. Desktop (md+): always in-flow and visible — never leave -translate-x-full on.
          'fixed inset-y-0 left-0 z-40 shadow-xl transition-transform duration-200',
          'md:static md:translate-x-0 md:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200/80 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Conversas
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 md:hidden"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3 pb-4 pt-3">
          <button
            type="button"
            onClick={onNew}
            disabled={newDisabled}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2.5',
              'text-sm font-medium text-white shadow-sm transition-colors',
              'hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50'
            )}
          >
            <MessageSquarePlus className="h-4 w-4" />
            Nova conversa
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1">
          {conversations.filter((c) => c.messages.length > 0 || c.id === activeId).length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-zinc-400">Nenhuma conversa ainda</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {conversations
                .filter((c) => c.messages.length > 0 || c.id === activeId)
                .map((c) => {
                const active = c.id === activeId;
                return (
                  <li key={c.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      className={cn(
                        'w-full rounded-xl px-3 py-2.5 text-left transition-colors',
                        active
                          ? 'bg-brand-50 text-brand-900 ring-1 ring-brand-200/80'
                          : 'text-zinc-700 hover:bg-zinc-100/80'
                      )}
                    >
                      <span className="block truncate pr-6 text-sm font-medium">
                        {c.messages.length === 0 ? 'Nova conversa' : c.title}
                      </span>
                      <span
                        className={cn(
                          'mt-0.5 block text-[11px]',
                          active ? 'text-brand-700/70' : 'text-zinc-400'
                        )}
                      >
                        {c.messages.length === 0 ? 'Rascunho' : relativeTime(c.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete(c.id);
                      }}
                      disabled={newDisabled}
                      className={cn(
                        'absolute right-2 top-2.5 rounded-md p-1 text-zinc-400',
                        'pointer-events-none opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600',
                        'group-hover:pointer-events-auto group-hover:opacity-100',
                        'focus:pointer-events-auto focus:opacity-100',
                        'disabled:pointer-events-none',
                        active && 'pointer-events-auto opacity-70'
                      )}
                      aria-label={`Excluir ${c.title}`}
                      title="Excluir conversa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

export default function AgentePage() {
  const [conversations, setConversations] = useState<AgenteConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConvId, setLoadingConvId] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);
  const loadingConvIdRef = useRef<string | null>(null);

  function setActiveConversation(id: string) {
    activeIdRef.current = id;
    setActiveId(id);
  }

  useEffect(() => {
    let cancelled = false;
    setMounted(true);
    void getProfile().then(async (p) => {
      if (cancelled || !p?.id) return;
      setUserId(p.id);
      setNome(primeiroNome(p.nome));

      const local = loadConversations(p.id).map(withDerivedTitle);
      let remote: AgenteConversation[] = [];
      try {
        remote = await fetchRemoteConversations(p.id);
      } catch {
        // Offline / RLS — keep local cache
      }
      if (cancelled) return;

      const stored = mergeConversationLists(local, remote);
      // #region agent log
      fetch('http://127.0.0.1:7617/ingest/48344d34-49d3-4296-a2de-2c9892396c64',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7e6ed1'},body:JSON.stringify({sessionId:'7e6ed1',runId:'post-fix',hypothesisId:'E',location:'agente/page.tsx:hydrate',message:'hydrate merge local+remote',data:{userIdSuffix:p.id.slice(-6),localCount:local.length,remoteCount:remote.length,mergedCount:stored.length,mergedWithMsgs:stored.filter((c)=>c.messages.length>0).length,ua:typeof navigator!=='undefined'?navigator.userAgent.slice(0,80):''},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      setConversations((prev) => {
        // Don't wipe in-flight / already-typed chats if hydrate arrives late
        const merged = new Map<string, AgenteConversation>();
        for (const c of stored) merged.set(c.id, c);
        for (const c of prev) {
          const existing = merged.get(c.id);
          if (!existing || c.messages.length >= existing.messages.length) {
            merged.set(c.id, withDerivedTitle(c));
          }
        }
        let list = [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        // At most one empty draft
        const empty = list.filter((c) => c.messages.length === 0);
        const withMsgs = list.filter((c) => c.messages.length > 0);
        if (empty.length > 1) {
          list = [...withMsgs, empty[0]];
        } else if (list.length === 0) {
          list = [createConversation()];
        }
        saveConversations(p.id, list);
        void persistRemoteConversations(p.id, list).catch(() => {});
        const prefer =
          (activeIdRef.current && list.find((c) => c.id === activeIdRef.current)?.id) ||
          list.find((c) => c.messages.length > 0)?.id ||
          list[0].id;
        setActiveConversation(prefer);
        return list;
      });
      hydratedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || !userId) return;
    // Never persist an empty wipe over real history during mount races
    if (conversations.length === 0) return;
    saveConversations(userId, conversations);
    void persistRemoteConversations(userId, conversations).catch(() => {});
  }, [conversations, userId]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const itens: ChatMessage[] = active?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [itens, loading, activeId]);

  function novaConversa() {
    if (loading) return;

    // Reuse existing empty draft — don't spam "Nova conversa" entries
    const existingEmpty = conversations.find((c) => c.messages.length === 0);
    if (existingEmpty) {
      setConversations((prev) => {
        const kept = prev.filter((c) => c.messages.length > 0 || c.id === existingEmpty.id);
        const draft = kept.find((c) => c.id === existingEmpty.id)!;
        return [{ ...draft, updatedAt: new Date().toISOString() }, ...kept.filter((c) => c.id !== draft.id)];
      });
      setActiveConversation(existingEmpty.id);
      setInput('');
      setSidebarOpen(false);
      inputRef.current?.focus();
      return;
    }

    const fresh = createConversation();
    setConversations((prev) => {
      const withMsgs = prev.filter((c) => c.messages.length > 0);
      return [fresh, ...withMsgs];
    });
    setActiveConversation(fresh.id);
    setInput('');
    setSidebarOpen(false);
    inputRef.current?.focus();
  }

  function selecionar(id: string) {
    if (id === activeIdRef.current) {
      setSidebarOpen(false);
      return;
    }
    setActiveConversation(id);
    setInput('');
    setSidebarOpen(false);
  }

  function excluir(id: string) {
    if (loading && loadingConvIdRef.current === id) return;
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      const withMsgs = next.filter((c) => c.messages.length > 0);
      if (activeIdRef.current !== id) {
        // Keep at most one empty draft among remaining
        const empty = next.find((c) => c.messages.length === 0);
        return empty ? [...withMsgs, empty] : withMsgs.length > 0 ? withMsgs : [createConversation()];
      }
      if (withMsgs.length > 0) {
        setActiveConversation(withMsgs[0].id);
        return withMsgs;
      }
      const fresh = createConversation();
      setActiveConversation(fresh.id);
      return [fresh];
    });
  }

  function patchConversation(
    conversationId: string,
    updater: (c: AgenteConversation) => AgenteConversation
  ) {
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === conversationId ? updater(c) : c));
      return [...next].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  }

  async function enviar(texto: string) {
    const message = texto.trim();
    if (!message || loading) return;

    let conversationId = activeIdRef.current;
    if (!conversationId) {
      const fresh = createConversation();
      setConversations((prev) => [fresh, ...prev]);
      setActiveConversation(fresh.id);
      conversationId = fresh.id;
    }

    const cid = conversationId;
    setInput('');
    patchConversation(cid, (c) => {
      const firstUser = c.messages.find((m) => m.role === 'user');
      let title = c.title;
      if (!firstUser) {
        title = titleFromFirstMessage(message);
      } else if (c.title === DEFAULT_CONVERSATION_TITLE && firstUser.role === 'user') {
        title = titleFromFirstMessage(firstUser.text);
      }
      return {
        ...c,
        title,
        updatedAt: new Date().toISOString(),
        messages: [...c.messages, { role: 'user', text: message }],
      };
    });
    loadingConvIdRef.current = cid;
    setLoadingConvId(cid);
    setLoading(true);

    try {
      const res = await enviarMensagemAgente(message, cid);
      patchConversation(cid, (c) => ({
        ...c,
        updatedAt: new Date().toISOString(),
        messages: [...c.messages, { role: 'assistant', messages: res.messages }],
      }));
    } catch (e) {
      const errText =
        e instanceof Error ? e.message : 'Não foi possível obter resposta do agente.';
      patchConversation(cid, (c) => ({
        ...c,
        updatedAt: new Date().toISOString(),
        messages: [...c.messages, { role: 'error', text: errText }],
      }));
    } finally {
      loadingConvIdRef.current = null;
      setLoadingConvId(null);
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void enviar(input);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void enviar(input);
    }
  }

  const vazio = itens.length === 0 && !(loading && loadingConvId === activeId);
  const saudacao = mounted ? saudacaoDoDia() : 'Olá';
  const titulo = nome ? `${saudacao}, ${nome}` : saudacao;
  const showLoadingInPanel = loading && loadingConvId === activeId;

  useEffect(() => {
    if (vazio) return;
    const el = messagesScrollRef.current;
    // #region agent log
    fetch('http://127.0.0.1:7617/ingest/48344d34-49d3-4296-a2de-2c9892396c64',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7e6ed1'},body:JSON.stringify({sessionId:'7e6ed1',runId:'layout-fix',hypothesisId:'A',location:'agente/page.tsx:scrollMetrics',message:'layout scroll metrics',data:{docScrollH:document.documentElement.scrollHeight,winH:window.innerHeight,docOverflows:document.documentElement.scrollHeight>window.innerHeight+2,msgClientH:el?.clientHeight??null,msgScrollH:el?.scrollHeight??null,msgCanScroll:!!el&&el.scrollHeight>el.clientHeight+2},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [itens.length, activeId, vazio]);

  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 flex-1 overflow-hidden',
        'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-50 via-zinc-50 to-zinc-50'
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_center,_rgba(167,129,92,0.12),_transparent_70%)]"
      />

      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={selecionar}
        onNew={novaConversa}
        onDelete={excluir}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        newDisabled={loading}
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile chats toggle */}
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200/70 bg-white/60 px-3 py-2 backdrop-blur-sm md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5',
              'text-sm font-medium text-zinc-700 shadow-sm hover:border-brand-300 hover:text-brand-800'
            )}
          >
            <MessagesSquare className="h-4 w-4 text-bronze-500" />
            Chats
          </button>
          <span className="truncate text-sm text-zinc-500">
            {active?.title ?? DEFAULT_CONVERSATION_TITLE}
          </span>
        </div>

        {vazio ? (
          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8 sm:px-6">
            <div
              className={cn(
                'flex w-full max-w-xl flex-col items-center text-center',
                'animate-[agente-fade-in_0.55s_ease-out_both]'
              )}
            >
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1d1d1d] shadow-md shadow-brand-900/10">
                <Image
                  src="/logo-intt-letra-amarela.webp"
                  alt="INTT"
                  width={44}
                  height={32}
                  className="object-contain"
                  priority
                />
              </div>

              <h2 className="font-sans text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                {titulo}
              </h2>
              <p className="mt-1.5 font-sans text-lg font-medium text-zinc-600 sm:text-xl">
                como posso te ajudar hoje?
              </p>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-500">
                Pergunte sobre KPIs, transferências ou produtos citados. Cada conversa tem memória
                própria e sincroniza com a sua conta.
              </p>

              <div className="mt-8 w-full animate-[agente-fade-in_0.55s_ease-out_0.12s_both]">
                <Composer
                  value={input}
                  onChange={setInput}
                  onSubmit={onSubmit}
                  onKeyDown={onKeyDown}
                  disabled={loading}
                  inputRef={inputRef}
                  variant="hero"
                />
              </div>

              <div className="mt-8 w-full animate-[agente-fade-in_0.55s_ease-out_0.22s_both]">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                  Explorar por área
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {SUGGESTIONS.map(({ label, prompt, icon: Icon }) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void enviar(prompt)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3.5 py-2',
                        'text-sm text-zinc-700 shadow-sm transition-all',
                        'hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-800 hover:shadow',
                        'active:scale-[0.98]'
                      )}
                      title={prompt}
                    >
                      <Icon className="h-3.5 w-3.5 text-bronze-500" strokeWidth={2} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={messagesScrollRef}
              className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
            >
              <div className="mx-auto flex max-w-2xl flex-col gap-4">
                {itens.map((item, i) => {
                  const key = `${activeId}-${i}-${item.role}`;
                  if (item.role === 'user') {
                    return (
                      <div
                        key={key}
                        className="flex justify-end animate-[agente-fade-in_0.3s_ease-out]"
                      >
                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm text-white whitespace-pre-wrap">
                          {item.text}
                        </div>
                      </div>
                    );
                  }

                  if (item.role === 'error') {
                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                      >
                        {item.text}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={key}
                      className="flex flex-col gap-2 animate-[agente-fade-in_0.3s_ease-out]"
                    >
                      {item.messages.map((msg: AgenteMessage, j: number) => {
                        if (msg.kind === 'text') {
                          return (
                            <div
                              key={j}
                              className="max-w-[90%] rounded-2xl rounded-bl-md border border-zinc-200/80 bg-white/90 px-4 py-2.5 text-sm text-zinc-800 shadow-sm"
                              dangerouslySetInnerHTML={{
                                __html: formatAgenteTextToHtml(msg.text ?? ''),
                              }}
                            />
                          );
                        }
                        if (msg.kind === 'document' && msg.url) {
                          return (
                            <div key={j} className="flex">
                              <a
                                href={msg.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                              >
                                <Download className="h-4 w-4" />
                                Baixar Excel
                                {msg.title ? (
                                  <span className="font-normal text-white/80">— {msg.title}</span>
                                ) : null}
                              </a>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  );
                })}

                {showLoadingInPanel && (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                    Consultando o agente…
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            <div className="relative shrink-0 border-t border-zinc-200/70 bg-white/70 backdrop-blur-sm">
              <Composer
                value={input}
                onChange={setInput}
                onSubmit={onSubmit}
                onKeyDown={onKeyDown}
                disabled={loading}
                inputRef={inputRef}
                variant="dock"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
