import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicPreviewUrl } from "@/lib/r2";
import { Uploader } from "@/components/uploader";
import { GallerySettingsForm } from "./settings-form";
import { ShareLink } from "./share-link";
import { MediaGrid } from "./media-grid";
import { OrderCard, type SalesOrder } from "@/components/order-card";

export default async function GaleriaPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: fotografo } = await supabase
    .from("photographers")
    .select("display_name, plan")
    .eq("id", user?.id)
    .single();

  const { data: galeria } = await supabase
    .from("galleries")
    .select("*")
    .eq("id", params.id)
    .eq("photographer_id", user?.id)
    .single();

  if (!galeria) notFound();

  const { data: midias } = await supabase
    .from("media")
    .select("id, type, r2_key_preview, width, height, position")
    .eq("gallery_id", galeria.id)
    .order("position", { ascending: true });

  const { data: pedidos } = await supabase
    .from("orders")
    .select("id, client_identifier, client_email, status, total_cents, created_at, payment_method, order_items(media_id, product_name, product_type, media(r2_key_preview))")
    .eq("gallery_id", galeria.id)
    .order("created_at", { ascending: false });

  const midiasComUrl = (midias ?? []).map((m) => ({
    ...m,
    previewUrl: publicPreviewUrl(m.r2_key_preview!),
  }));

  // Fotos que os clientes favoritaram/escolheram (coraçãozinho) na galeria
  // pública — serve pra montar um pacote sob medida mesmo antes da compra.
  const { data: favoritosRaw } = midiasComUrl.length
    ? await supabase
        .from("media_selections")
        .select("media_id, client_identifier")
        .eq("favorited", true)
        .in("media_id", midiasComUrl.map((m) => m.id))
    : { data: [] as { media_id: string; client_identifier: string }[] };
  const previewPorMidia = new Map(midiasComUrl.map((m) => [m.id, m.previewUrl]));
  const favoritosPorCliente = new Map<string, { previewUrl: string }[]>();
  for (const f of favoritosRaw ?? []) {
    const url = previewPorMidia.get(f.media_id);
    if (!url) continue;
    const lista = favoritosPorCliente.get(f.client_identifier) ?? [];
    lista.push({ previewUrl: url });
    favoritosPorCliente.set(f.client_identifier, lista);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">{galeria.title}</h1>
        {galeria.client_name && (
          <p className="text-sm text-neutral-500">Cliente: {galeria.client_name}</p>
        )}
      </div>

      <section className="flex flex-wrap items-center gap-4">
        <Uploader
          galleryId={galeria.id}
          watermarkText={fotografo?.display_name ?? "Titan Galeria"}
          watermarkEnabled={galeria.watermark_previews}
          plano={fotografo?.plan ?? "gratuito"}
        />
        <ShareLink shareToken={galeria.share_token} />
      </section>

      <MediaGrid galleryId={galeria.id} midias={midiasComUrl} />

      <GallerySettingsForm galeria={galeria} previewPhotos={midiasComUrl.filter((m) => m.type === "photo").slice(0, 8).map((m) => m.previewUrl)} />

      <section className="rounded-xl border border-neutral-200 bg-white p-5"><h2 className="font-semibold">Vender arquivos deste álbum</h2><p className="mt-2 text-sm text-neutral-600">Crie uma oferta de download por arquivo, pacote completo ou impressão vinculada a esta galeria. Seus clientes pagam no seu Pix.</p><a href={`/painel/produtos?galeria=${galeria.id}`} className="mt-3 inline-block text-sm underline">Configurar produtos e preços desta galeria →</a></section>

      {favoritosPorCliente.size > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="font-semibold">Fotos escolhidas pelos clientes</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Toque no coraçãozinho na galeria pública marca estas fotos. Se não houver preço por
            arquivo cadastrado ainda, use essa lista pra montar um pacote sob medida e combinar o
            valor direto com o cliente.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {[...favoritosPorCliente.entries()].map(([cliente, fotos]) => (
              <div key={cliente}>
                <p className="mb-2 text-sm font-medium">{cliente} · {fotos.length} {fotos.length === 1 ? "foto" : "fotos"}</p>
                <div className="flex flex-wrap gap-2">
                  {fotos.map((f, i) => (
                    <img key={i} src={f.previewUrl} alt="" className="h-16 w-16 rounded-md object-cover" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Pedidos
        </h2>
        {!pedidos?.length && (
          <p className="text-sm text-neutral-500">Nenhum pedido ainda nesta galeria.</p>
        )}
        <div className="flex flex-col gap-2">
          {pedidos?.map((p) => <OrderCard key={p.id} order={p as unknown as SalesOrder} />)}
        </div>
      </section>
    </div>
  );
}
