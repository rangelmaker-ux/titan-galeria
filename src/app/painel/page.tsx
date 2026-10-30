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
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Capa: a primeira foto enviada, independentemente de reordenações posteriores.
  const idsGalerias = (galerias ?? []).map((g) => g.id);
  const capasPorGaleria = new Map<string, string>();
  if (idsGalerias.length) {
    const { data: midias } = await supabase
      .from("media")
      .select("gallery_id, r2_key_preview, position, created_at")
      .in("gallery_id", idsGalerias)
      .eq("type", "photo")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
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

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {galerias?.map((g) => {
          const capa = capasPorGaleria.get(g.id);
          return (
            <Link
              key={g.id}
              href={`/painel/galerias/${g.id}`}
              className="group flex min-w-0 items-center gap-4 rounded-xl border border-neutral-200 bg-white p-3 transition hover:border-neutral-400 hover:shadow-sm"
            >
              <div className="relative mt-2 h-20 w-24 shrink-0 rounded-lg rounded-tl-none border border-neutral-200 bg-neutral-100 p-1.5 before:absolute before:-top-2 before:left-[-1px] before:h-2 before:w-10 before:rounded-t-md before:border before:border-b-0 before:border-neutral-200 before:bg-neutral-100 sm:h-24 sm:w-28">
                {capa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={publicPreviewUrl(capa)}
                    alt=""
                    className="h-full w-full rounded object-cover"
                    loading="lazy"
                    width={112}
                    height={96}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-center text-xs text-neutral-400">
                    Sem fotos
                  </div>
                )}
              </div>
              <div className="min-w-0 py-2">
                <p className="truncate font-medium" title={g.title}>{g.title}</p>
                {g.client_name && (
                  <p className="truncate text-sm text-neutral-500">{g.client_name}</p>
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
