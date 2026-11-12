import Link from 'next/link';
import { Info } from 'lucide-react';

type Relacionada = { href: string; label: string };

/** Caixa curta no topo da página dizendo, em linguagem simples, o que aparece ali e o que NÃO aparece. */
export function PaginaIntro({ children, veja }: { children: React.ReactNode; veja?: Relacionada[] }) {
  return (
    <div className="flex gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
      <div className="space-y-1">
        <p>{children}</p>
        {veja && veja.length > 0 && (
          <p className="text-xs text-zinc-500">
            Veja também:{' '}
            {veja.map((v, i) => (
              <span key={v.href}>
                {i > 0 && ' · '}
                <Link href={v.href} className="font-medium text-brand-600 hover:underline">
                  {v.label}
                </Link>
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
