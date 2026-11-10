import { redirect } from 'next/navigation';

// Rota antiga — mantida só para links salvos.
export default function TransferenciasRamonRedirect() {
  redirect('/dashboard/atendimento-humano');
}
