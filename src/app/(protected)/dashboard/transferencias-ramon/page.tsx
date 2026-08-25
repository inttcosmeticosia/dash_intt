'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { KpiCardNumber } from '@/components/KpiCard';
import { DataTable } from '@/components/charts';
import { ResumoCell } from '@/components/ResumoCell';
import { useFilters } from '@/contexts/FilterContext';
import { cleanResumo, downloadCsv, formatDateTime, formatPhone } from '@/lib/utils';
import {
  getRelatorioTransferenciasRamon,
  type TransferenciaRamonRow,
} from '@/services/analytics';

export default function TransferenciasRamonPage() {
  const { periodo } = useFilters();
  const [linhas, setLinhas] = useState<TransferenciaRamonRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    let ativo = true;
    getRelatorioTransferenciasRamon(periodo)
      .then((r) => {
        if (!ativo) return;
        setLinhas(r);
        setErro(null);
      })
      .catch((e) => {
        console.error(e);
        if (ativo) setErro('Não foi possível carregar os dados. Verifique sua conexão e tente novamente.');
      });
    return () => {
      ativo = false;
    };
  }, [periodo]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const rows = linhas ?? [];
    if (!q) return rows;
    return rows.filter((l) =>
      [l.nome_cliente, l.telefone_cliente, l.telefone_mencionado, l.resumo, l.mensagem]
        .some((campo) => campo?.toLowerCase().includes(q))
    );
  }, [linhas, busca]);

  const sessoesDistintas = useMemo(() => {
    const rows = linhas ?? [];
    return new Set(rows.map((l) => l.telefone_cliente)).size;
  }, [linhas]);

  if (erro) return <div className="text-red-500">{erro}</div>;
  if (!linhas) return <div className="text-zinc-400">Carregando...</div>;

  function exportar() {
    downloadCsv(
      `transferencias_ramon_${periodo.inicio}_${periodo.fim}.csv`,
      ['Data', 'Cliente', 'Telefone Cliente', 'Telefone Mencionado', 'Resumo', 'Mensagem'],
      filtradas.map((l) => [
        formatDateTime(l.data),
        l.nome_cliente,
        l.telefone_cliente,
        l.telefone_mencionado,
        l.resumo ? cleanResumo(l.resumo, Number.MAX_SAFE_INTEGER) : null,
        l.mensagem,
      ])
    );
  }

  if (linhas.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCardNumber label="Menções no Período" value={0} />
          <KpiCardNumber label="Sessões Distintas" value={0} />
        </div>
        <p className="text-sm text-zinc-500">Nenhuma menção de telefone no período</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardNumber label="Menções no Período" value={linhas.length} />
        <KpiCardNumber label="Sessões Distintas" value={sessoesDistintas} />
      </div>

      <div className="relative min-w-64 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente, telefone ou resumo..."
          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm"
        />
      </div>

      <DataTable
        title={`Transferencias Ramon (${filtradas.length}${filtradas.length !== linhas.length ? ` de ${linhas.length}` : ''})`}
        pageSize={15}
        actions={
          <button
            onClick={exportar}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        }
        columns={[
          { key: 'data', label: 'Data', format: (v) => formatDateTime(String(v)) },
          { key: 'nome_cliente', label: 'Cliente' },
          { key: 'telefone_cliente', label: 'Telefone Cliente', format: (v) => formatPhone(v as string) },
          { key: 'telefone_mencionado', label: 'Telefone Mencionado', format: (v) => formatPhone(v as string) },
          { key: 'resumo', label: 'Resumo', format: (v) => <ResumoCell value={v} /> },
          { key: 'mensagem', label: 'Mensagem' },
        ]}
        rows={filtradas as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
