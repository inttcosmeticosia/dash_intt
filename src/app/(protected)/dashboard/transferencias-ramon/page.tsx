import { redirect } from 'next/navigation';

// Antiga aba "Transferência Atendimento": agora é a aba "Pelo atendimento" da página Representantes.
export default function TransferenciasAtendimentoPage() {
  redirect('/dashboard/handoffs?origem=humano');
}
