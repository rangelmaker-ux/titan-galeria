import { COVER_FONTS, coverDesign, type CoverDesign } from "@/lib/gallery-cover";

export function GalleryCover({ design, imageUrl, title, photographer, preview = false }: { design?: Partial<CoverDesign> | null; imageUrl?: string; title: string; photographer?: string; preview?: boolean }) {
  const cover = coverDesign(design);
  return <section aria-label="Capa da galeria" className={`gallery-cover relative isolate flex items-end justify-center overflow-hidden bg-neutral-950 text-center text-white ${preview ? "min-h-80 rounded-xl" : "min-h-[100svh]"}`}>
    {imageUrl && <img src={imageUrl} alt="" fetchPriority={preview ? "auto" : "high"} className="gallery-cover-photo absolute inset-0 -z-20 h-full w-full object-cover" style={{ opacity: cover.opacity / 100, objectPosition: `50% ${cover.position}%` }} />}
    <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/65 via-transparent to-black/10" />
    <div className={`gallery-cover-text w-full max-w-4xl px-6 ${preview ? "py-10" : "pb-16 pt-32 sm:pb-24"}`} style={{ fontFamily: COVER_FONTS[cover.textFont].family }}>
      {(cover.signature || photographer) && <p className="mb-6 text-xs uppercase tracking-[0.25em]">{cover.signature || photographer}</p>}
      <h1 className={`break-words font-normal leading-tight ${preview ? "text-3xl" : "text-4xl sm:text-6xl"}`} style={{ fontFamily: COVER_FONTS[cover.titleFont].family }}>{cover.title || title}</h1>
      {cover.subtitle && <p className="mt-4 whitespace-pre-line text-base sm:text-lg">{cover.subtitle}</p>}
      {cover.date && <p className="mt-5 text-xs uppercase tracking-[0.2em]">{new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${cover.date}T12:00:00Z`))}</p>}
      <a href={preview ? undefined : "#galeria"} aria-disabled={preview || undefined} tabIndex={preview ? -1 : undefined} className="mt-8 inline-block border border-white/80 px-10 py-3 text-xs uppercase tracking-[0.2em] transition hover:bg-white hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Ver galeria</a>
    </div>
  </section>;
}
