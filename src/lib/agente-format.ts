/** Escapa HTML e aplica formatação leve estilo WhatsApp (*negrito* + quebras). */
export function formatAgenteTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return escaped
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br />');
}
