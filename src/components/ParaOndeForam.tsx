'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, ExternalLink, UserCheck } from 'lucide-react';
import { INICIO_REGISTRO_SITE } from '@/services/analytics';

type Props = { representantes: number | null; suporte: number | null; site: number | null };

const dataBr = (iso: string) => iso.split('-').reverse().join('/');

/** Visão Geral: os 3 caminhos de um cliente, com barra proporcional e link para cada página. */
export function ParaOndeForam({ representantes, suporte, site }: Props) {
  const itens = [
    {
      href: '/dashboard/handoffs',
      icon: UserCheck,
      titulo: 'Representantes',
      valor: representantes,
      texto: 'Revenda: recebeu o contato de um representante.',
      barra: 'bg-sky-500',
      icone: 'bg-sky-50 text-sky-700',
    },
    {
      href: '/dashboard/reclamacoes',
      icon: AlertTriangle,
      titulo: 'Reclamações e Suporte',
      valor: suporte,
      texto: 'Já comprou e teve problema: foi para o atendimento.',
      barra: 'bg-red-500',
      icone: 'bg-red-50 text-red-700',
    },
    {
      href: '/dashboard/site',
      icon: ExternalLink,
      titulo: 'Enviados ao Site',
      valor: site,
      texto: `A Cris mandou o link do site (desde ${dataBr(INICIO_REGISTRO_SITE)}).`,
      barra: 'bg-emerald-500',
      icone: 'bg-emerald-50 text-emerald-700',
    },
  ];
  const total = itens.reduce((s, i) => s + (i.valor ?? 0), 0);

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-end justify-between gap-2 px-5 pt-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Para onde foram os clientes</h3>
          <p className="text-xs text-zinc-500">Cada cliente atendido pela Cris segue um destes caminhos (ou fica só com a IA).</p>
        </div>
        {total > 0 && <p className="text-xs text-zinc-400">{total} encaminhamentos no período</p>}
      </header>

      <div className="mx-5 mt-3 flex h-2.5 overflow-hidden rounded-full bg-zinc-100">
        {total > 0 &&
          itens.map((i) =>
            i.valor ? (
              <div key={i.href} className={i.barra} style={{ width: `${(i.valor / total) * 100}%` }} title={`${i.titulo}: ${i.valor}`} />
            ) : null
          )}
      </div>

      <div className="mt-2 grid divide-y divide-zinc-100 md:grid-cols-3 md:divide-x md:divide-y-0">
        {itens.map(({ href, icon: Icon, titulo, valor, texto, icone }) => (
          <Link key={href} href={href} className="group flex gap-3 px-5 py-4 transition-colors hover:bg-zinc-50">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${icone}`}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center justify-between gap-2 text-sm font-medium text-zinc-600">
                {titulo}
                <ArrowUpRight className="h-4 w-4 text-zinc-300 transition-colors group-hover:text-brand-600" />
              </p>
              <p className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight text-zinc-900">{valor ?? '—'}</span>
                {valor != null && total > 0 && (
                  <span className="text-xs text-zinc-400">{Math.round((valor / total) * 100)}%</span>
                )}
              </p>
              <p className="text-xs text-zinc-500">{texto}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
