import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createDownloadUrl } from "@/lib/r2";

/** Lista as URLs de download assinadas (expiram em 5min) de um pedido já
 * pago. Chamado pela página pública da galeria depois do retorno do Stripe. */
export async function GET(_req: NextRequest, { params }: { params: { orderId: string } }) {
  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, gallery_id")
    .eq("id", params.orderId)
    .single();
  if (!order) return NextResponse.json({ error: "pedido não encontrado" }, { status: 404 });
  if (order.status !== "paid") {
    return NextResponse.json({ error: "pedido ainda não confirmado" }, { status: 402 });
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("media_id, products(type)")
    .eq("order_id", order.id);

  const precisaTudo = items?.some((i: any) => i.products?.type === "download_all");

  let mediaIds: string[];
  if (precisaTudo) {
    const { data: todaMidia } = await supabase
      .from("media")
      .select("id")
      .eq("gallery_id", order.gallery_id);
    mediaIds = (todaMidia ?? []).map((m) => m.id);
  } else {
    mediaIds = (items ?? []).map((i) => i.media_id).filter(Boolean) as string[];
  }

  const { data: midias } = await supabase
    .from("media")
    .select("id, r2_key_original")
    .in("id", mediaIds);

  const links = await Promise.all(
    (midias ?? []).map(async (m) => ({
      mediaId: m.id,
      url: await createDownloadUrl(m.r2_key_original),
    }))
  );

  return NextResponse.json({ links });
}
