import { CoverForm } from "./cover-form";
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
    .select("display_name, plan, watermark_logo_url, watermark_pos_x, watermark_pos_y, watermark_scale, watermark_opacity")
    .eq("id", user?.id)
    .single();

  const { data: galeria } = await supabase
    .from("galleries")
    .select("*")
    .eq("id", params.id)
    .eq("photographer_id", user?.id)
    .is("deleted_at", null)
    .single();

  if (!galeria) notFound();

  const { data: midias } = await supabase
    .from("media")
    .select("id, type, r2_key_preview, width, height, position")
    .eq("gallery_id", galeria.id)
    .order("position", { ascending: true });

  // Produtos de download já cadastrados pra esta galeria, só pra mostrar de
  // cara se já tem preço por arquivo e/ou pacote completo configurado.
  const { data: produtosDownload } = await supabase
    .from("products")
    .select("id, type, name, price_cents, active")
    .eq("gallery_id", galeria.id)
    .in("type", ["download_single", "download_all"])
    .is("deleted_at", null);
  const precoUnidade = produtosDownload?.find((p) => p.type === "download_single" && p.active);
  const precoPacote = produtosDownload?.find((p) => p.type === "download_all" && p.active);

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
          watermark={galeria.watermark_previews ? (fotografo?.watermark_logo_url ? {
            logoUrl: fotografo.watermark_logo_url,
            posX: fotografo.watermark_pos_x ?? 50,
            posY: fotografo.watermark_pos_y ?? 50,
            scale: fotografo.watermark_scale ?? 20,
            opacity: fotografo.watermark_opacity ?? 70,
          } : (fotografo?.display_name ?? "Titan Galeria")) : null}
          plano={fotografo?.plan ?? "gratuito"}
        />
        <ShareLink shareToken={galeria.share_token} />
      </section>

      <MediaGrid galleryId={galeria.id} midias={midiasComUrl} />

      <CoverForm galleryId={galeria.id} title={galeria.title} photographer={fotografo?.display_name || ""} initial={galeria.delivery_design} photos={midiasComUrl.filter((m) => m.type === "photo")} />

      <GallerySettingsForm galeria={galeria} previewPhotos={midiasComUrl.filter((m) => m.type === "photo").slice(0, 8).map((m) => m.previewUrl)} />

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold">Cobrança de downloads</h2>
        <p className="mt-2 text-sm text-neutral-600">
          {galeria.allow_downloads
            ? "Esta galeria está liberada pra download gratuito (o botão \"Permitir download gratuito\" acima está ativado) — desative-o ali pra passar a cobrar."
            : "Esta galeria não libera download de graça. Configure abaixo como você cobra por ela:"}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-4">
            <p className="text-sm font-medium">Por foto (unidade)</p>
            <p className="mt-1 text-lg font-semibold">{precoUnidade ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(precoUnidade.price_cents / 100) : "Não configurado"}</p>
            <p className="mt-1 text-xs text-neutral-500">O cliente escolhe as fotos que quer e paga por cada uma.</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-4">
            <p className="text-sm font-medium">Pacote completo (ilimitado)</p>
            <p className="mt-1 text-lg font-semibold">{precoPacote ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(precoPacote.price_cents / 100) : "Não configurado"}</p>
            <p className="mt-1 text-xs text-neutral-500">Um valor único e o cliente baixa quantas fotos quiser do evento.</p>
          </div>
        </div>
        <a href={`/painel/produtos?galeria=${galeria.id}`} className="mt-4 inline-block text-sm underline">Configurar os preços desta galeria →</a>
      </section>

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
