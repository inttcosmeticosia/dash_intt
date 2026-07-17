import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function formatPercent(value: number | null | undefined) {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function defaultPeriod() {
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 29);
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
  };
}

export function formatChartDate(iso: string) {
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return iso;
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}

export function formatPhone(phone: string | null | undefined) {
  if (!phone) return '—';
  if (phone.startsWith('55') && (phone.length === 12 || phone.length === 13)) {
    const ddd = phone.slice(2, 4);
    const resto = phone.slice(4);
    return `+55 (${ddd}) ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`;
  }
  return `+${phone}`;
}

export function normalizeName(name: string | null | undefined) {
  return (name ?? '')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase();
}

export function cleanResumo(resumo: string | null | undefined, max = 160) {
  if (!resumo) return '—';
  const limpo = resumo.replace(/\\n/g, ' · ').replace(/\s+/g, ' ').trim();
  return limpo.length > max ? `${limpo.slice(0, max)}…` : limpo;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(';')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
