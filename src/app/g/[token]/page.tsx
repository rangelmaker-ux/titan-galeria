import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { publicPreviewUrl } from "@/lib/r2";
import { PasswordGate } from "@/components/public/password-gate";
import { ClientGalleryView } from "@/components/public/client-gallery-view";
import { getPlan } from "@/lib/plans";
import { extractShareToken } from "@/lib/share-link";

// Sem isso, o fetch da galeria (via supabase-js) podia ficar em cache e a
// página pública continuava mostrando dados antigos (senha removida, modo
// ao vivo, etc) mesmo depois de salvos — crítico ainda mais com o modo ao
// vivo, que depende de cada refresh trazer as fotos novas.
export const dynamic = "force-dynamic";

export default async function GaleriaPublicaPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { pedido?: string; orderId?: string };
}) {
  const supabase = createServiceClient();
  // A URL pública pode trazer o nome do cliente no final (ver src/lib/share-link.ts)
  // — o token de verdade é sempre os primeiros 16 caracteres do parâmetro.
  const token = extractShareToken(params.token);

  const { data: galeria } = await supabase
    .from("galleries")
    .select(
      "id, title, client_name, password_hash, allow_favorites, allow_downloads, photographer_id, template, realtime_mode, is_published, delivery_design, welcome_message, require_client_name"
    )
    .eq("share_token", token)
    .is("deleted_at", null)
    .single();
  if (!galeria) notFound();

  const cookieStore = cookies();
  const desbloqueada = !galeria.password_hash || cookieStore.get(`g_${token}_ok`)?.value === "1";

  if (!desbloqueada) {
    return <PasswordGate token={token} galleryTitle={galeria.title} />;
  }

  const { data: midias } = await supabase
    .from("media")
    .select("id, type, r2_key_preview, width, height, position")
    .eq("gallery_id", galeria.id)
    .order("position", { ascending: true });

  const { data: produtos } = await supabase
    .from("products")
    .select("id, type, name, price_cents, currency, print_size")
    .eq("photographer_id", galeria.photographer_id)
    .eq("gallery_id", galeria.id)
    .is("deleted_at", null)
    .eq("active", true);

  const { data: fotografo } = await supabase
    .from("photographers")
    .select("plan, display_name")
    .eq("id", galeria.photographer_id)
    .single();
  const marcaTitan = !getPlan(fotografo?.plan).marcaPropria;

  const midiasComUrl = (midias ?? []).map((m) => ({
    ...m,
    previewUrl: publicPreviewUrl(m.r2_key_preview!),
  }));

  // Portfólio público (sem venda) usa o coraçãozinho como curtida simples,
  // sem pedir nome de pagador — por isso aqui já soma quantas curtidas cada
  // foto tem pra mostrar junto do ícone.
  const likeCounts: Record<string, number> = {};
  if (galeria.is_published && midiasComUrl.length) {
    const { data: favoritosRaw } = await supabase
      .from("media_selections")
      .select("media_id")
      .eq("favorited", true)
      .in("media_id", midiasComUrl.map((m) => m.id));
    for (const row of favoritosRaw ?? []) {
      likeCounts[row.media_id] = (likeCounts[row.media_id] ?? 0) + 1;
    }
  }

  return (
    <ClientGalleryView
      cover={galeria.delivery_design}
      welcomeMessage={galeria.welcome_message}
      requireClientName={galeria.require_client_name}
      photographerName={fotografo?.display_name || ""}
      shareToken={token}
      title={galeria.title}
      clientName={galeria.client_name}
      allowFavorites={galeria.allow_favorites}
      allowDownloads={galeria.allow_downloads}
      midias={midiasComUrl}
      produtos={produtos ?? []}
      pedidoStatus={searchParams.pedido}
      orderId={searchParams.orderId}
      marcaTitan={marcaTitan}
      template={galeria.template}
      aoVivo={galeria.realtime_mode}
      isPortfolio={galeria.is_published}
      likeCounts={likeCounts}
    />
  );
}
