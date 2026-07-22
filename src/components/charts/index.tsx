'use client';

import { useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatNumber } from '@/lib/utils';

// Paleta categórica da marca. Cor segue a entidade em todos os gráficos.
export const SERIES = {
  novos: '#bd3a41', // bordô
  ativos: '#b97a1c', // bronze
  transferidos: '#1f9d8a', // teal
  extra: '#5b7fe0', // azul
} as const;

type ChartData = Record<string, string | number>;
type ValueFormat = 'currency' | 'number';

function formatChartValue(value: number, format: ValueFormat) {
  if (format === 'currency') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }
  return formatNumber(value);
}

type ChartTooltipProps = {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  valueFormat: ValueFormat;
};

function ChartTooltip({ active, payload, label, valueFormat }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-medium text-zinc-500">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
          {entry.name}: {formatChartValue(Number(entry.value ?? 0), valueFormat)}
        </p>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-700">{title}</h3>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ title, description }: { title: string; description?: string }) {
  return (
    <ChartCard title={title} description={description}>
      <div className="flex h-[280px] items-center justify-center text-sm text-zinc-400">
        Sem dados para exibir no período selecionado
      </div>
    </ChartCard>
  );
}

/** Quantos ticks pular no eixo X para ~6–8 labels legíveis. */
function xTickSkip(count: number) {
  if (count <= 8) return 0;
  if (count <= 14) return 1;
  if (count <= 21) return 2;
  if (count <= 35) return 4;
  return Math.max(5, Math.ceil(count / 7) - 1);
}

export function LineChartCard({
  title,
  description,
  data,
  xKey,
  lines,
  valueFormat = 'number',
}: {
  title: string;
  description?: string;
  data: ChartData[];
  xKey: string;
  lines: { key: string; color: string; name: string }[];
  valueFormat?: ValueFormat;
}) {
  if (!data.length) return <EmptyChart title={title} description={description} />;

  const showDots = data.length <= 45;
  const tickSkip = xTickSkip(data.length);

  return (
    <ChartCard title={title} description={description}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: '#71717a' }}
            tickLine={false}
            axisLine={{ stroke: '#e4e4e7' }}
            interval={tickSkip}
            minTickGap={28}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#71717a' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatNumber}
            width={48}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip valueFormat={valueFormat} />} />
          {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {lines.map((l) => (
            <Line
              key={l.key}
              type="linear"
              dataKey={l.key}
              stroke={l.color}
              name={l.name}
              strokeWidth={2}
              dot={showDots ? { r: 3, strokeWidth: 0, fill: l.color } : false}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function BarChartCard({
  title,
  description,
  data,
  xKey,
  bars,
  valueFormat = 'number',
  layout = 'vertical',
  yWidth = 110,
}: {
  title: string;
  description?: string;
  data: ChartData[];
  xKey: string;
  bars: { key: string; color: string; name: string }[];
  valueFormat?: ValueFormat;
  layout?: 'vertical' | 'horizontal';
  yWidth?: number;
}) {
  if (!data.length) return <EmptyChart title={title} description={description} />;

  const isHorizontal = layout === 'horizontal';
  // Série única na horizontal vira "ranking": barra fina com trilho, valor na
  // ponta, sem grid/eixo X (o label direto substitui a leitura pelo eixo).
  const isRanking = isHorizontal && bars.length === 1;
  const truncate = (v: unknown) => {
    const s = String(v);
    return s.length > 16 ? `${s.slice(0, 15)}…` : s;
  };

  const tickSkip = xTickSkip(data.length);
  const rotateLabels = !isHorizontal && data.length > 10 && tickSkip <= 1;

  return (
    <ChartCard title={title} description={description}>
      <ResponsiveContainer width="100%" height={isHorizontal ? Math.max(220, data.length * (isRanking ? 40 : 34)) : 300}>
        <BarChart
          data={data}
          layout={isHorizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: isRanking ? 36 : 16, left: 8, bottom: rotateLabels ? 12 : 8 }}
        >
          {!isRanking && (
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={!isHorizontal} vertical={isHorizontal} />
          )}
          {isHorizontal ? (
            <>
              <XAxis
                type="number"
                hide={isRanking}
                tick={{ fontSize: 11, fill: '#71717a' }}
                tickLine={false}
                axisLine={{ stroke: '#e4e4e7' }}
                tickFormatter={formatNumber}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                width={yWidth}
                tick={{ fontSize: 11, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={truncate}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 11, fill: '#71717a' }}
                tickLine={false}
                axisLine={{ stroke: '#e4e4e7' }}
                interval={tickSkip}
                minTickGap={32}
                angle={rotateLabels ? -35 : 0}
                textAnchor={rotateLabels ? 'end' : 'middle'}
                height={rotateLabels ? 52 : 30}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatNumber}
                width={48}
                allowDecimals={false}
              />
            </>
          )}
          <Tooltip content={<ChartTooltip valueFormat={valueFormat} />} cursor={{ fill: 'rgba(130, 24, 28, 0.06)' }} />
          {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {bars.map((b) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.name}
              fill={b.color}
              radius={isHorizontal ? (isRanking ? [0, 9, 9, 0] : [0, 4, 4, 0]) : [4, 4, 0, 0]}
              maxBarSize={isRanking ? 18 : 32}
              background={isRanking ? { fill: 'rgba(0, 0, 0, 0.04)', radius: 9 } : undefined}
            >
              {isRanking && (
                <LabelList dataKey={b.key} position="right" style={{ fontSize: 11, fill: '#71717a' }} />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function DataTable({
  title,
  columns,
  rows,
  pageSize,
  actions,
}: {
  title: string;
  columns: { key: string; label: string; format?: (v: unknown) => string }[];
  rows: Record<string, unknown>[];
  pageSize?: number;
  actions?: ReactNode;
}) {
  const [page, setPage] = useState(0);

  const totalPages = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages - 1);
  const visible = pageSize ? rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize) : rows;
  const inicio = rows.length === 0 ? 0 : currentPage * (pageSize ?? rows.length) + 1;
  const fim = pageSize ? Math.min((currentPage + 1) * pageSize, rows.length) : rows.length;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-zinc-700">{title}</h3>
        {actions}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
              {columns.map((c) => (
                <th key={c.key} className="px-5 py-2 font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-5 py-8 text-center text-zinc-400">Sem dados</td></tr>
            ) : (
              visible.map((row, i) => (
                <tr key={i} className="border-b border-zinc-50 hover:bg-brand-50/60:bg-zinc-800/30">
                  {columns.map((c) => (
                    <td key={c.key} className="px-5 py-2.5 text-zinc-700">
                      {c.format ? c.format(row[c.key]) : String(row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pageSize && rows.length > pageSize && (
        <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 text-sm">
          <span className="text-xs text-zinc-500">
            {inicio}–{fim} de {rows.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40:bg-zinc-800"
            >
              Anterior
            </button>
            <span className="text-xs text-zinc-500">
              {currentPage + 1}/{totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
              className="rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40:bg-zinc-800"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
