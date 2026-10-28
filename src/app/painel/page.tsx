import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { publicPreviewUrl } from "@/lib/r2";

export default async function PainelGaleriasPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: galerias } = await supabase
    .from("galleries")
    .select("id, title, slug, client_name, is_published, share_token, created_at")
    .eq("photographer_id", user?.id)
    .order("created_at", { ascending: false });

  // capa de cada álbum: a primeira foto enviada (menor "position"; empate
  // resolvido pela mais antiga) de cada galeria, numa única query.
  const idsGalerias = (galerias ?? []).map((g) => g.id);
  const capasPorGaleria = new Map<string, string>();
  if (idsGalerias.length) {
    const { data: midias } = await supabase
      .from("media")
      .select("gallery_id, r2_key_preview, position, created_at")
      .in("gallery_id", idsGalerias)
      .eq("type", "photo")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    for (const m of midias ?? []) {
      if (!capasPorGaleria.has(m.gallery_id) && m.r2_key_preview) {
        capasPorGaleria.set(m.gallery_id, m.r2_key_preview);
      }
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Seus álbuns</h1>
        <Link
          href="/painel/galerias/nova"
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper"
        >
          + Nova galeria
        </Link>
      </div>

      {!galerias?.length && (
        <p className="text-sm text-neutral-500">
          Você ainda não criou nenhuma galeria. Clique em "Nova galeria" pra começar.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {galerias?.map((g) => {
          const capa = capasPorGaleria.get(g.id);
          return (
            <Link
              key={g.id}
              href={`/painel/galerias/${g.id}`}
              className="group overflow-hidden rounded-xl border border-neutral-200 transition hover:border-neutral-400"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                {capa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={publicPreviewUrl(capa)}
                    alt=""
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                    Sem fotos ainda
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="font-medium">{g.title}</p>
                {g.client_name && (
                  <p className="text-sm text-neutral-500">{g.client_name}</p>
                )}
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${
                    g.is_published
                      ? "bg-green-100 text-green-700"
                      : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {g.is_published ? "Publicada no portfólio" : "Só por link"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
