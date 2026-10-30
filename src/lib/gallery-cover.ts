export const COVER_FONTS = {
  sans: { label: "Moderna", family: "Arial, Helvetica, sans-serif" },
  serif: { label: "Clássica", family: "Georgia, Times New Roman, serif" },
  editorial: { label: "Editorial", family: "Palatino Linotype, Book Antiqua, Palatino, serif" },
  mono: { label: "Minimalista", family: "Courier New, monospace" },
  cursive: { label: "Manuscrita", family: "Segoe Script, Brush Script MT, cursive" },
} as const;
export type CoverFont = keyof typeof COVER_FONTS;
export type CoverDesign = { mediaId: string | null; opacity: number; position: number; title: string; subtitle: string; signature: string; date: string; titleFont: CoverFont; textFont: CoverFont };
export function coverDesign(value?: Partial<CoverDesign> | null): CoverDesign {
  return { mediaId: value?.mediaId ?? null, opacity: value?.opacity ?? 65, position: value?.position ?? 50, title: value?.title ?? "", subtitle: value?.subtitle ?? "", signature: value?.signature ?? "", date: value?.date && /^\d{4}-\d{2}-\d{2}$/.test(value.date) && Number.isFinite(Date.parse(value.date)) ? value.date : "", titleFont: value?.titleFont && Object.prototype.hasOwnProperty.call(COVER_FONTS, value.titleFont) ? value.titleFont : "sans", textFont: value?.textFont && Object.prototype.hasOwnProperty.call(COVER_FONTS, value.textFont) ? value.textFont : "sans" };
}
