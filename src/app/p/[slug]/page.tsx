import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { publicPreviewUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

export default async function PortfolioPublicoPage({ params }: { params: { slug: string } }) {
  const supabase = createServiceClient();

  const { data: fotografo } = await supabase
    .from("photographers")
    .select("id, display_name, bio, avatar_url, instagram, whatsapp")
    .eq("slug", params.slug)
    .single();
  if (!fotografo) notFound();

  const { data: galerias } = await supabase
    .from("galleries")
    .select("id, title, slug, cover_media_id")
    .eq("photographer_id", fotografo.id)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  // busca a mídia de capa de cada galeria (ou a primeira mídia, se nenhuma
  // capa foi escolhida ainda).
  const capasPorGaleria = await Promise.all(
    (galerias ?? []).map(async (g) => {
      const { data: capa } = await supabase
        .from("media")
        .select("r2_key_preview")
        .eq("gallery_id", g.id)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      return { galeriaId: g.id, url: capa ? publicPreviewUrl(capa.r2_key_preview!) : null };
    })
  );
  const capaUrl = Object.fromEntries(capasPorGaleria.map((c) => [c.galeriaId, c.url]));

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-14 flex flex-col items-center text-center">
        {fotografo.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fotografo.avatar_url}
            alt={fotografo.display_name}
            className="mb-5 h-24 w-24 rounded-full object-cover ring-1 ring-neutral-200"
          />
        ) : (
          <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-neutral-900 text-2xl font-semibold text-white">
            {fotografo.display_name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <h1 className="text-3xl font-semibold">{fotografo.display_name}</h1>
        {fotografo.bio && <p className="mx-auto mt-3 max-w-xl text-neutral-600">{fotografo.bio}</p>}
        <div className="mt-4 flex justify-center gap-4 text-sm text-neutral-500">
          {fotografo.instagram && (
            <a href={`https://instagram.com/${fotografo.instagram.replace("@", "")}`} target="_blank">
              {fotografo.instagram}
            </a>
          )}
          {fotografo.whatsapp && <span>{fotografo.whatsapp}</span>}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {galerias?.map((g) => (
          <Link key={g.id} href={`/p/${params.slug}/${g.slug}`} className="group">
            <div className="aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100 shadow-sm transition group-hover:shadow-md">
              {capaUrl[g.id] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={capaUrl[g.id]!}
                  alt={g.title}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              )}
            </div>
            <p className="mt-2 text-sm font-medium">{g.title}</p>
          </Link>
        ))}
      </div>

      {!galerias?.length && (
        <p className="text-center text-sm text-neutral-500">Nenhuma galeria publicada ainda.</p>
      )}
    </main>
  );
}
