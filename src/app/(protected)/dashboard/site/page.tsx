'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { KpiCardNumber } from '@/components/KpiCard';
import { DataTable } from '@/components/charts';
import { useFilters } from '@/contexts/FilterContext';
import { cleanResumo, downloadCsv, formatDateTime, formatPhone } from '@/lib/utils';
import { getRelatorioSite, type SiteRow } from '@/services/analytics';

export default function SitePage() {
  const { periodo } = useFilters();
  const [linhas, setLinhas] = useState<SiteRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    let ativo = true;
    getRelatorioSite(periodo)
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
      [l.nome_cliente, l.telefone, l.regiao, l.cidade, l.tipo_cliente, l.resumo]
        .some((campo) => campo?.toLowerCase().includes(q))
    );
  }, [linhas, busca]);

  if (erro) return <div className="text-red-500">{erro}</div>;
  if (!linhas) return <div className="text-zinc-400">Carregando...</div>;

  function exportar() {
    downloadCsv(
      `site_${periodo.inicio}_${periodo.fim}.csv`,
      ['Data', 'Cliente', 'Telefone', 'Região', 'Cidade', 'Tipo', 'Resumo'],
      filtradas.map((l) => [
        formatDateTime(l.data),
        l.nome_cliente,
        l.telefone,
        l.regiao,
        l.cidade,
        l.tipo_cliente,
        l.resumo ? cleanResumo(l.resumo, Number.MAX_SAFE_INTEGER) : null,
      ])
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardNumber label="Passaram pelo Site" value={linhas.length} />
      </div>

      <div className="relative min-w-64 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente, telefone, região, cidade ou resumo..."
          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm"
        />
      </div>

      <DataTable
        title={`Conversas do Site (${filtradas.length}${filtradas.length !== linhas.length ? ` de ${linhas.length}` : ''})`}
        pageSize={15}
        actions={
          <button
            onClick={exportar}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        }
        columns={[
          { key: 'data', label: 'Data', format: (v) => formatDateTime(String(v)) },
          { key: 'nome_cliente', label: 'Cliente' },
          { key: 'telefone', label: 'Telefone', format: (v) => formatPhone(v as string) },
          { key: 'regiao', label: 'Região' },
          { key: 'cidade', label: 'Cidade' },
          { key: 'tipo_cliente', label: 'Tipo' },
          { key: 'resumo', label: 'Resumo', format: (v) => cleanResumo(v as string | null) },
        ]}
        rows={filtradas as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
