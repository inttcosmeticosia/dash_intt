'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cleanResumo } from '@/lib/utils';

export function ResumoCell({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const raw = value as string | null | undefined;
  const preview = cleanResumo(raw);
  const full = cleanResumo(raw, Number.MAX_SAFE_INTEGER);
  const truncated = preview !== full;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div className="max-w-xs">
        <span>{preview}</span>
        {truncated && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-0.5 block text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
          >
            Ver completo
          </button>
        )}
      </div>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-sm font-semibold text-zinc-700">
                Resumo completo
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Fechar
              </button>
            </div>
            <p className="text-sm leading-relaxed text-zinc-700">{full}</p>
          </div>
        </div>
      )}
    </>
  );
}
