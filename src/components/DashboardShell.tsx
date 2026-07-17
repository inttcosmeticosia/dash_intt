'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Globe, LayoutDashboard, LogOut, Package, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PeriodFilter } from '@/components/PeriodFilter';
import { FilterProvider } from '@/contexts/FilterContext';
import { signOut } from '@/services/analytics';

const nav = [
  { href: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/dashboard/handoffs', label: 'Transferências', icon: UserCheck },
  { href: '/dashboard/produtos', label: 'Produtos', icon: Package },
  { href: '/dashboard/internacional', label: 'Internacional', icon: Globe },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <FilterProvider>
      <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto bg-[#1d1d1d] md:flex">
          <div className="flex flex-col items-center gap-2 border-b border-white/10 px-5 py-6">
            <Image src="/logo-intt-letra-amarela.webp" alt="INTT Cosméticos" width={110} height={80} priority />
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Analytics</span>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  pathname === href
                    ? 'bg-brand-600 text-white'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <button
            onClick={handleLogout}
            className="m-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </aside>

        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {nav.find((n) => n.href === pathname)?.label ?? 'Dashboard'}
              </h1>
              <PeriodFilter />
            </div>
          </header>
          <div className="p-6">{children}</div>
        </main>
      </div>
    </FilterProvider>
  );
}
