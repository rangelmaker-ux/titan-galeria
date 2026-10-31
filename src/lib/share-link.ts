/** Link público da galeria com o nome do cliente no final, pra ficar mais
 * pessoal do que só um código aleatório (ex: /g/x7Kp2bQ9-ana-e-joao).
 *
 * O token continua sendo o controle de acesso de verdade. O tamanho dele
 * MUDOU ao longo do tempo (três formatos já existiram no banco):
 *   - 16 chars  — gen_random_bytes(12) em base64url (migration 0001)
 *   - 32 chars  — gen_random_bytes(16) em hex (migration 0005, ficava feio)
 *   - 11 chars  — gen_random_bytes(8) em base64url (migration 0016, atual)
 * Galerias antigas mantêm o token que já tinham na criação — não são
 * migradas —, então o parâmetro da rota pode vir em qualquer um dos três
 * tamanhos. Por isso NUNCA se corta por uma posição fixa só: `shareTokenCandidates`
 * devolve os três recortes possíveis e quem chamar resolve contra o banco
 * (`.in("share_token", candidatos)`), usando o valor que realmente bateu —
 * nunca o palpite — pra tudo que vier depois (cookie, props, outras
 * chamadas). O nome do cliente é só um sufixo cosmético: nunca enfraquece a
 * segurança do link nem precisa ficar sincronizado se o fotógrafo renomear
 * o cliente depois. */
export const SHARE_TOKEN_LENGTHS = [11, 16, 32] as const;

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

/** Todos os recortes possíveis do token real a partir do parâmetro de rota
 * `/g/<param>` — um por tamanho de token que esse campo já teve (ver
 * SHARE_TOKEN_LENGTHS acima). Quem chamar deve resolver contra o banco
 * (ex: `.in("share_token", shareTokenCandidates(param))`) e usar o valor
 * que realmente bateu como o token de verdade dali pra frente — nunca um
 * destes recortes direto, que é só um palpite até confirmar no banco. */
export function shareTokenCandidates(param: string): string[] {
  const candidatos = SHARE_TOKEN_LENGTHS.map((len) => param.slice(0, len));
  return [...new Set(candidatos)];
}
