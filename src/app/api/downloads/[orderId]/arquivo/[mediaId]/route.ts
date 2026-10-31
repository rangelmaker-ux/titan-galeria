import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchDriveFileStream, getDriveFileMeta } from "@/lib/drive";
import { getDriveAccount } from "@/lib/drive-account";
import { canReadOrder } from "@/lib/order-access";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // vídeos grandes podem demorar mais pra passar pelo proxy

/** Entrega o arquivo ORIGINAL em alta resolução de um pedido pago, fazendo
 * proxy do Google Drive (o original nunca é exposto publicamente — só sai
 * daqui depois de conferir de novo que o pedido está pago). */
export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string; mediaId: string } }
) {
  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, gallery_id, payment_method, access_token_hash, galleries(photographer_id, watermark_previews)")
    .eq("id", params.orderId)
    .single();
  if (!order || !["paid", "fulfilled"].includes(order.status) || !canReadOrder(req, order)) {
    return NextResponse.json({ error: "pedido não confirmado" }, { status: 403 });
  }

  const { data: items, error: itemsError } = await supabase.from("order_items").select("media_id, product_type, products(type)").eq("order_id", order.id);
  if (itemsError) return NextResponse.json({ error: "não foi possível conferir a liberação" }, { status: 500 });
  const allowed = (items || []).some((i: any) => order.payment_method === "manual_pix"
    ? i.media_id === params.mediaId && i.product_type !== "print"
    : i.products?.type === "download_all" || (i.media_id === params.mediaId && i.products?.type !== "print"));
  if (!allowed) return NextResponse.json({ error: "arquivo não incluído neste pedido" }, { status: 403 });

  // confere que essa mídia pertence mesmo à galeria do pedido — evita
  // baixar mídia de outra galeria só trocando o mediaId na URL.
  const { data: midia } = await supabase
    .from("media")
    .select("id, drive_file_id, r2_key_original, r2_key_preview")
    .eq("id", params.mediaId)
    .eq("gallery_id", order.gallery_id)
    .single();
  if (!midia) return NextResponse.json({ error: "arquivo não encontrado" }, { status: 404 });

  // Marca d'água ligada nessa galeria = o máximo que libera é a prévia (menor
  // resolução, com marca). Desligada = original em alta resolução, sem marca.
  // Isso lê o estado ATUAL da galeria a cada download — então ligar/desligar
  // vale na hora pra tudo que já está na galeria, sem precisar reprocessar
  // nenhuma foto enviada antes.
  const galeriaInfoWatermark = Array.isArray(order.galleries) ? order.galleries[0] : order.galleries;
  const marcaDaguaAtiva = (galeriaInfoWatermark as { watermark_previews?: boolean } | undefined)?.watermark_previews;
  if (marcaDaguaAtiva) {
    if (!midia.r2_key_preview) return NextResponse.json({ error: "prévia indisponível" }, { status: 404 });
    const { publicPreviewUrl } = await import("@/lib/r2");
    return NextResponse.redirect(publicPreviewUrl(midia.r2_key_preview));
  }

  if (!midia.drive_file_id) {
    // mídia antiga, enviada antes da migração pro Drive — ainda no R2.
    if (!midia.r2_key_original) {
      return NextResponse.json({ error: "arquivo indisponível" }, { status: 404 });
    }
    const { createDownloadUrl } = await import("@/lib/r2");
    const url = await createDownloadUrl(midia.r2_key_original);
    return NextResponse.redirect(url);
  }

  try {
    const galeriaInfo = Array.isArray(order.galleries) ? order.galleries[0] : order.galleries;
    const photographerId = (galeriaInfo as { photographer_id: string } | undefined)?.photographer_id;
    const account = photographerId ? await getDriveAccount(photographerId) : {};
    const [meta, fileRes] = await Promise.all([
      getDriveFileMeta(account, midia.drive_file_id),
      fetchDriveFileStream(account, midia.drive_file_id),
    ]);

    return new NextResponse(fileRes.body, {
      headers: {
        "Content-Type": meta.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${(meta.name || "arquivo").replace(/"/g, "")}"`,
        ...(meta.size ? { "Content-Length": meta.size } : {}),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: "falha ao buscar o arquivo no Drive" }, { status: 502 });
  }
}
