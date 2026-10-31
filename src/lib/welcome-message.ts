import { COVER_FONTS, type CoverFont } from "./gallery-cover";

/** Mensagem de boas-vindas animada (fade in/out), mostrada antes do fluxo
 * atual (nome do pagador / galeria). Reaproveita as mesmas fontes da capa
 * (ver src/lib/gallery-cover.ts) pra manter o painel simples. Título e
 * corpo vazios = não mostra nada, pula direto pro fluxo de hoje. */
export type WelcomeMessage = { title: string; body: string; font: CoverFont };

export function parseWelcomeMessage(value?: Partial<WelcomeMessage> | null): WelcomeMessage {
  return {
    title: value?.title ?? "",
    body: value?.body ?? "",
    font: value?.font && Object.prototype.hasOwnProperty.call(COVER_FONTS, value.font) ? value.font : "sans",
  };
}

export function hasWelcomeMessage(value?: Partial<WelcomeMessage> | null): boolean {
  return !!(value?.title?.trim() || value?.body?.trim());
}
