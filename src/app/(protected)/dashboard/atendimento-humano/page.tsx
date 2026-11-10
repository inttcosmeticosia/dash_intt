import { TransferenciasView } from '@/components/TransferenciasView';

// Transferências feitas SÓ pelo atendimento humano (operador Bitrix passou o contato do representante).
// Fonte: handoff_events source='humano' (n8n [03] via registrar_mensagem_humana). A RPC filtra os
// eventos pela fonte antes de juntar por cliente/dia, então transferências da IA não entram aqui.
export default function AtendimentoHumanoPage() {
  return <TransferenciasView origemFixa="humano" />;
}
