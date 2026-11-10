import { TransferenciasView } from '@/components/TransferenciasView';

// Transferências feitas pelo atendimento humano (operador Bitrix passou o contato do representante).
// Fonte: handoff_events source='humano', gravado pelo n8n [03] via registrar_mensagem_humana.
export default function TransferenciasAtendimentoPage() {
  return <TransferenciasView origemFixa="humano" />;
}
