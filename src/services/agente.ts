export type AgenteMessage =
  | { kind: 'text'; text: string; typing_seconds?: number }
  | {
      kind: 'document';
      url: string;
      title?: string;
      mime?: string;
      extension?: string;
      source?: string;
      id?: string;
    };

export type AgenteResponse = {
  messages: AgenteMessage[];
  metadata?: Record<string, unknown>;
};

export async function enviarMensagemAgente(
  message: string,
  conversationId?: string
): Promise<AgenteResponse> {
  const res = await fetch('/api/agente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversationId }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errMsg =
      typeof data?.error === 'string' ? data.error : `Erro ${res.status} ao falar com o agente`;
    throw new Error(errMsg);
  }

  return data as AgenteResponse;
}
