'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { SuporteRow } from '@/services/analytics';

/** Faixa vermelha: reclamações de urgência alta que o atendimento ainda não respondeu. */
export function AlertaSuporte({ linhas, comLink = false }: { linhas: SuporteRow[]; comLink?: boolean }) {
  const pendentesAlta = linhas.filter((l) => l.urgencia === 'alta' && !l.respondido);
  const pendentes = linhas.filter((l) => !l.respondido);
  if (pendentes.length === 0) return null;

  const alta = pendentesAlta.length > 0;
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
        alta ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <p className="flex-1">
        {alta ? (
          <>
            <b>{pendentesAlta.length}</b> {pendentesAlta.length === 1 ? 'reclamação urgente' : 'reclamações urgentes'} sem
            resposta do atendimento
            {pendentes.length > pendentesAlta.length && <> · {pendentes.length} pendentes no total</>}.
          </>
        ) : (
          <>
            <b>{pendentes.length}</b> {pendentes.length === 1 ? 'pedido de suporte' : 'pedidos de suporte'} aguardando o
            atendimento.
          </>
        )}
      </p>
      {comLink && (
        <Link href="/dashboard/reclamacoes" className="font-semibold underline underline-offset-2">
          Ver reclamações
        </Link>
      )}
    </div>
  );
}
