import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Galerias publicadas usam a mesma visualização/fluxo de favoritos e
 * compras da entrega por link (/g/[token]) — aqui só resolvemos o slug
 * público pro share_token e redirecionamos, evitando duplicar toda a
 * lógica de carrinho/favoritos em dois lugares. */
export default async function GaleriaPublicadaPage({
  params,
}: {
  params: { slug: string; gallerySlug: string };
}) {
  const supabase = createServiceClient();

  const { data: fotografo } = await supabase
    .from("photographers")
    .select("id")
    .eq("slug", params.slug)
    .single();
  if (!fotografo) notFound();

  const { data: galeria } = await supabase
    .from("galleries")
    .select("share_token")
    .eq("photographer_id", fotografo.id)
    .eq("slug", params.gallerySlug)
    .eq("is_published", true)
    .single();
  if (!galeria) notFound();

  redirect(`/g/${galeria.share_token}`);
}
