'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { signIn } from '@/services/analytics';

function safeNextPath(raw: string | null): string {
  if (!raw) return '/dashboard';
  // Only same-origin relative dashboard paths — block open redirects
  if (!raw.startsWith('/dashboard')) return '/dashboard';
  if (raw.startsWith('//') || raw.includes('\\') || raw.includes('://')) return '/dashboard';
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      router.push(safeNextPath(searchParams.get('next')));
      router.refresh();
    } catch {
      setError('E-mail ou senha incorretos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#141414] px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(130, 24, 28, 0.35), transparent), radial-gradient(ellipse 50% 40% at 85% 110%, rgba(167, 129, 92, 0.15), transparent)',
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-3">
          <Image src="/logo-intt-letra-amarela.webp" alt="INTT Cosméticos" width={190} height={139} priority />
          <p className="text-sm tracking-wide text-zinc-400">Relatórios de atendimento WhatsApp</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-bronze-400/60 focus:bg-white/10"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-bronze-400/60 focus:bg-white/10"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#141414]" />}>
      <LoginForm />
    </Suspense>
  );
}
