'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { defaultPeriod } from '@/lib/utils';

type Period = { inicio: string; fim: string };

type FilterContextValue = {
  periodo: Period;
  setPeriodo: (p: Period) => void;
};

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [periodo, setPeriodo] = useState<Period>(defaultPeriod());

  return (
    <FilterContext.Provider value={{ periodo, setPeriodo }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be used within FilterProvider');
  return ctx;
}
