import type { SuporteRow, Urgencia } from '@/services/analytics';

export const BITRIX_URL = 'https://inttcosmeticos.bitrix24.com.br';

/** Link para achar o cliente no CRM do Bitrix (busca pelo telefone; de lá abre o chat). */
export function linkBitrix(telefone: string) {
  return `${BITRIX_URL}/crm/contact/list/?apply_filter=Y&FIND=${encodeURIComponent(telefone)}`;
}

export const URGENCIA_LABEL: Record<Urgencia, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

export const URGENCIA_ESTILO: Record<Urgencia, string> = {
  alta: 'bg-red-100 text-red-700 ring-red-200',
  media: 'bg-amber-100 text-amber-800 ring-amber-200',
  baixa: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
};

const ORDEM: Record<Urgencia, number> = { alta: 0, media: 1, baixa: 2 };

/** Sem resposta do atendimento primeiro, depois urgência, depois mais recente. */
export function ordenarSuporte(linhas: SuporteRow[]) {
  return [...linhas].sort(
    (a, b) =>
      Number(a.respondido) - Number(b.respondido) ||
      ORDEM[a.urgencia] - ORDEM[b.urgencia] ||
      b.data.localeCompare(a.data)
  );
}

const VERBO: Record<string, string> = {
  'Atraso de pedido': 'reclamou de atraso',
  'Defeito / item faltando': 'relatou defeito/item faltando',
  'Reação/alergia': 'relatou reação ao produto',
  'Status / rastreio': 'pediu status/rastreio',
  'Reclamação / insatisfação': 'reclamou',
  'Erro no checkout': 'teve erro para finalizar a compra',
  Cadastro: 'teve problema no cadastro',
};

/** Frase curta: "Cliente reclamou de atraso do pedido 4503; atendimento entrou e passou o rastreio." */
export function fraseResumo(l: SuporteRow) {
  const quem = l.nome_cliente ?? 'Cliente';
  const oque = VERBO[l.categoria] ?? 'pediu suporte';
  const pedido = l.numero_pedido ? ` (pedido ${l.numero_pedido})` : ' (sem nº do pedido)';
  const atendimento = l.respondido
    ? `atendimento entrou e ${primeiraMinuscula(l.acao_atendimento ?? 'respondeu o cliente')}.`
    : 'aguardando o atendimento responder.';
  return `${quem} ${oque}${pedido}; ${atendimento}`;
}

function primeiraMinuscula(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Horas desde o encaminhamento (para o alerta de "sem resposta"). */
export function horasDesde(iso: string) {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 36e5);
}

export function tempoTexto(horas: number) {
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${Math.round(horas)} h`;
  return `${Math.round(horas / 24)} dias`;
}
