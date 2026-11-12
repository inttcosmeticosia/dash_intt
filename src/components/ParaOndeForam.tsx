'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, ExternalLink, UserCheck } from 'lucide-react';

type Props = { representantes: number | null; suporte: number | null; site: number | null };

/** Card da Visão Geral: os 3 destinos possíveis de um cliente, com link para cada página. */
export function ParaOndeForam({ representantes, suporte, site }: Props) {
  const itens = [
    {
      href: '/dashboard/handoffs',
      icon: UserCheck,
      titulo: 'Representantes',
      valor: representantes,
      texto: 'Revenda: receberam o contato de um representante comercial.',
      cor: 'text-sky-700 bg-sky-50',
    },
    {
      href: '/dashboard/reclamacoes',
      icon: AlertTriangle,
      titulo: 'Reclamações e Suporte',
      valor: suporte,
      texto: 'Já compraram e tiveram problema: passados para o atendimento.',
      cor: 'text-red-700 bg-red-50',
    },
    {
      href: '/dashboard/site',
      icon: ExternalLink,
      titulo: 'Enviados ao Site',
      valor: site,
      texto: 'Uso próprio: a Cris mandou comprar direto no site.',
      cor: 'text-emerald-700 bg-emerald-50',
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-zinc-700">Para onde foram os clientes</h3>
        <p className="text-xs text-zinc-500">Cada cliente atendido pela Cris termina num destes 3 caminhos (ou segue só com a IA).</p>
      </div>
      <div className="grid divide-y divide-zinc-100 md:grid-cols-3 md:divide-x md:divide-y-0">
        {itens.map(({ href, icon: Icon, titulo, valor, texto, cor }) => (
          <Link key={href} href={href} className="group flex gap-3 p-5 transition-colors hover:bg-zinc-50">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cor}`}>
              <Icon className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-sm font-medium text-zinc-600">
                {titulo}
                <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </p>
              <p className="text-2xl font-semibold tracking-tight text-zinc-900">{valor ?? '—'}</p>
              <p className="text-xs text-zinc-500">{texto}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
