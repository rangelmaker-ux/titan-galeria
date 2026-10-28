import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Suas galerias</h1>
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
        {galerias?.map((g) => (
          <Link
            key={g.id}
            href={`/painel/galerias/${g.id}`}
            className="rounded-xl border border-neutral-200 p-4 transition hover:border-neutral-400"
          >
            <p className="font-medium">{g.title}</p>
            {g.client_name && (
              <p className="text-sm text-neutral-500">Cliente: {g.client_name}</p>
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
          </Link>
        ))}
      </div>
    </div>
  );
}
