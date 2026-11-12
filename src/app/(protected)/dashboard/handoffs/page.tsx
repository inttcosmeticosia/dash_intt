import { TransferenciasView } from '@/components/TransferenciasView';

// Clientes encaminhados para um representante comercial (pela IA e/ou pelo atendimento humano).
// Suporte/reclamações ficam na página própria (/dashboard/reclamacoes).
export default async function HandoffsPage({ searchParams }: { searchParams: Promise<{ origem?: string }> }) {
  const { origem } = await searchParams;
  return <TransferenciasView origemInicial={origem === 'ia' || origem === 'humano' ? origem : ''} />;
}
