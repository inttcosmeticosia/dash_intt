import { formatPhone } from '@/lib/utils';

/** Nome em cima, telefone embaixo; marca quando o nome veio só do perfil do WhatsApp. */
export function ClienteCell({
  nome,
  telefone,
  fonte,
  extra,
}: {
  nome: string | null | undefined;
  telefone: string | null | undefined;
  fonte?: string | null;
  extra?: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 truncate font-medium text-zinc-900">
        <span className="truncate">{nome || 'Sem nome'}</span>
        {fonte === 'whatsapp' && (
          <span
            title="O cliente não disse o nome na conversa; este é o nome do perfil do WhatsApp."
            className="shrink-0 rounded bg-emerald-50 px-1 py-px text-[10px] font-medium text-emerald-700"
          >
            WhatsApp
          </span>
        )}
      </p>
      <p className="truncate text-xs text-zinc-500">
        {formatPhone(telefone)}
        {extra && <span className="text-zinc-400"> · {extra}</span>}
      </p>
    </div>
  );
}
