import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { publicPreviewUrl } from "@/lib/r2";
import { PasswordGate } from "@/components/public/password-gate";
import { ClientGalleryView } from "@/components/public/client-gallery-view";
import { getPlan } from "@/lib/plans";

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

  const { data: galeria } = await supabase
    .from("galleries")
    .select(
      "id, title, client_name, password_hash, allow_favorites, allow_downloads, photographer_id, template, realtime_mode"
    )
    .eq("share_token", params.token)
    .single();
  if (!galeria) notFound();

  const cookieStore = cookies();
  const desbloqueada = !galeria.password_hash || cookieStore.get(`g_${params.token}_ok`)?.value === "1";

  if (!desbloqueada) {
    return <PasswordGate token={params.token} galleryTitle={galeria.title} />;
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
    .eq("active", true);

  const { data: fotografo } = await supabase
    .from("photographers")
    .select("plan")
    .eq("id", galeria.photographer_id)
    .single();
  const marcaTitan = !getPlan(fotografo?.plan).marcaPropria;

  const midiasComUrl = (midias ?? []).map((m) => ({
    ...m,
    previewUrl: publicPreviewUrl(m.r2_key_preview!),
  }));

  return (
    <ClientGalleryView
      shareToken={params.token}
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
    />
  );
}
