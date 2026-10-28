export type GalleryTemplate = "grid" | "masonry" | "minimal";

export const LAYOUT_GRID: Record<GalleryTemplate, string> = {
  grid: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
  masonry: "columns-2 gap-3 sm:columns-3 lg:columns-4 space-y-3",
  minimal: "mx-auto flex max-w-2xl flex-col gap-8",
};
export const LAYOUT_ITEM: Record<GalleryTemplate, string> = {
  grid: "aspect-square",
  masonry: "mb-3 break-inside-avoid",
  minimal: "",
};
