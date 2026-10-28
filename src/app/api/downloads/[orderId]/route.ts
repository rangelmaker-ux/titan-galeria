import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** Lista os links de download de um pedido já pago. Cada link aponta pro
 * nosso próprio proxy (/api/downloads/[orderId]/arquivo/[mediaId]), que
 * confere o pagamento de novo e busca o arquivo original no Google Drive —
 * o original nunca fica público nem no Drive nem em outro lugar. */
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

  const links = mediaIds.map((mediaId) => ({
    mediaId,
    url: `/api/downloads/${order.id}/arquivo/${mediaId}`,
  }));

  return NextResponse.json({ links });
}
