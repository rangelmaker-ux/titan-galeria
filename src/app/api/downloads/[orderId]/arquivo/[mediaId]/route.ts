import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchDriveFileStream, getDriveFileMeta } from "@/lib/drive";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // vídeos grandes podem demorar mais pra passar pelo proxy

/** Entrega o arquivo ORIGINAL em alta resolução de um pedido pago, fazendo
 * proxy do Google Drive (o original nunca é exposto publicamente — só sai
 * daqui depois de conferir de novo que o pedido está pago). */
export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string; mediaId: string } }
) {
  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, gallery_id")
    .eq("id", params.orderId)
    .single();
  if (!order || order.status !== "paid") {
    return NextResponse.json({ error: "pedido não confirmado" }, { status: 403 });
  }

  // confere que essa mídia pertence mesmo à galeria do pedido — evita
  // baixar mídia de outra galeria só trocando o mediaId na URL.
  const { data: midia } = await supabase
    .from("media")
    .select("id, drive_file_id, r2_key_original")
    .eq("id", params.mediaId)
    .eq("gallery_id", order.gallery_id)
    .single();
  if (!midia) return NextResponse.json({ error: "arquivo não encontrado" }, { status: 404 });

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
    const [meta, fileRes] = await Promise.all([
      getDriveFileMeta(midia.drive_file_id),
      fetchDriveFileStream(midia.drive_file_id),
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
