import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils';

type KpiCardProps = {
  label: string;
  value: string;
  subtitle?: string;
  trend?: number | null;
  className?: string;
};

export function KpiCard({ label, value, subtitle, trend, className }: KpiCardProps) {
  const trendUp = trend != null && trend > 0;
  const trendDown = trend != null && trend < 0;

  return (
    <div className={cn('rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900', className)}>
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {trend != null && (
          <span
            className={cn(
              'text-xs font-medium',
              trendUp && 'text-emerald-600',
              trendDown && 'text-red-500',
              !trendUp && !trendDown && 'text-zinc-400'
            )}
          >
            {formatPercent(trend)} vs período anterior
          </span>
        )}
        {subtitle && <span className="text-xs text-zinc-400">{subtitle}</span>}
      </div>
    </div>
  );
}

export function KpiCardCurrency({
  label,
  value,
  trend,
  subtitle,
}: {
  label: string;
  value: number;
  trend?: number | null;
  subtitle?: string;
}) {
  return <KpiCard label={label} value={formatCurrency(value)} trend={trend} subtitle={subtitle} />;
}

export function KpiCardNumber({ label, value, subtitle }: { label: string; value: number; subtitle?: string }) {
  return <KpiCard label={label} value={formatNumber(value)} subtitle={subtitle} />;
}
