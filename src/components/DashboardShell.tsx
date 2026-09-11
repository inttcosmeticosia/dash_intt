'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ExternalLink,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  PhoneForwarded,
  UserCheck,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PeriodFilter } from '@/components/PeriodFilter';
import { FilterProvider } from '@/contexts/FilterContext';
import { signOut } from '@/services/analytics';

const nav = [
  { href: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/dashboard/handoffs', label: 'Transferências', icon: UserCheck },
  { href: '/dashboard/transferencias-ramon', label: 'Transferencias Ramon', icon: PhoneForwarded },
  { href: '/dashboard/site', label: 'Site', icon: ExternalLink },
  { href: '/dashboard/produtos', label: 'Produtos', icon: Package },
  { href: '/dashboard/internacional', label: 'Internacional', icon: Globe },
  { href: '/dashboard/agente', label: 'Agente', icon: MessageSquare },
];

function SidebarNav({
  pathname,
  onNavigate,
  onLogout,
}: {
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <div className="flex flex-col items-center gap-2 border-b border-white/10 px-5 py-6">
        <Image src="/logo-intt-letra-amarela.webp" alt="INTT Cosméticos" width={110} height={80} priority />
        <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Analytics</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-brand-600 text-white'
                : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </nav>
      <button
        type="button"
        onClick={onLogout}
        className="m-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAgente = pathname === '/dashboard/agente';
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    await signOut();
    router.push('/login');
    router.refresh();
  }

  const pageTitle = nav.find((n) => n.href === pathname)?.label ?? 'Dashboard';

  return (
    <FilterProvider>
      <div className="flex min-h-screen bg-zinc-50">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto bg-[#1d1d1d] md:flex">
          <SidebarNav pathname={pathname} onLogout={handleLogout} />
        </aside>

        {/* Mobile drawer */}
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
          className={cn(
            'fixed inset-0 z-40 bg-zinc-900/50 transition-opacity md:hidden',
            menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        />
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-[min(17.5rem,88vw)] flex-col bg-[#1d1d1d] shadow-2xl transition-transform duration-200 md:hidden',
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="absolute right-3 top-3 rounded-md p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
          <SidebarNav
            pathname={pathname}
            onNavigate={() => setMenuOpen(false)}
            onLogout={handleLogout}
          />
        </aside>

        <main className={cn('flex min-w-0 flex-1 flex-col', isAgente ? 'min-h-screen overflow-hidden' : 'overflow-auto')}>
          <header className="sticky top-0 z-30 shrink-0 border-b border-zinc-200 bg-white/90 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-brand-300 hover:text-brand-800 md:hidden"
                  aria-label="Abrir menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400 md:hidden">
                    INTT Analytics
                  </p>
                  <h1 className="truncate text-base font-semibold text-zinc-900 sm:text-lg">{pageTitle}</h1>
                </div>
              </div>
              {!isAgente && (
                <div className="w-full sm:ml-auto sm:w-auto">
                  <PeriodFilter />
                </div>
              )}
            </div>
          </header>
          <div className={cn(isAgente ? 'flex min-h-0 flex-1 flex-col' : 'p-4 sm:p-6')}>{children}</div>
        </main>
      </div>
    </FilterProvider>
  );
}
