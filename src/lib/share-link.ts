/** Link público da galeria com o nome do cliente no final, pra ficar mais
 * pessoal do que só um código aleatório (ex: /g/x7Kp2bQ9mZaR-ana-e-joao).
 *
 * O token continua sendo o controle de acesso de verdade — ele é gerado com
 * `encode(gen_random_bytes(12), 'base64url')` no banco (supabase/migrations
 * /0001_init.sql), que sempre resulta em exatamente 16 caracteres (12 bytes
 * é múltiplo de 3, então o base64url não tem padding). O nome do cliente é
 * só um sufixo cosmético: tudo que vem depois dos 16 primeiros caracteres
 * do parâmetro da rota é ignorado na hora de identificar a galeria, então
 * ele nunca enfraquece a segurança do link nem precisa ficar sincronizado
 * se o fotógrafo renomear o cliente depois. */
export const SHARE_TOKEN_LENGTH = 16;

/** Tira acentos e pontuação, deixando um texto seguro pra URL. */
export function slugify(text: string, maxLength = 60): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** Monta a URL pública a partir do token real + (opcional) nome do cliente. */
export function buildShareUrl(origin: string, shareToken: string, clientName?: string | null): string {
  const slug = clientName ? slugify(clientName) : "";
  return `${origin.replace(/\/$/, "")}/g/${shareToken}${slug ? `-${slug}` : ""}`;
}

/** Extrai o token real do parâmetro de rota `/g/<param>`, descartando
 * qualquer sufixo cosmético (`-ana-e-joao`). Os primeiros 16 caracteres são
 * sempre o token, independentemente de ele conter `-`/`_` (alfabeto do
 * base64url), então um corte por posição é confiável — nunca por split. */
export function extractShareToken(param: string): string {
  return param.slice(0, SHARE_TOKEN_LENGTH);
}
