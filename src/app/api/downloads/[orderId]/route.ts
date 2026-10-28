import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { canReadOrder, whatsappLink } from "@/lib/order-access";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const db = createServiceClient();
  const { data: order } = await db.from("orders").select("id, status, gallery_id, payment_method, access_token_hash, client_identifier, total_cents, pix_key_snapshot, whatsapp_snapshot").eq("id", params.orderId).single();
  if (!order) return NextResponse.json({ error: "pedido não encontrado" }, { status: 404 });
  if (!canReadOrder(req, order)) return NextResponse.json({ error: "Abra o pedido no mesmo navegador em que ele foi criado." }, { status: 403 });
  if (order.payment_method === "manual_pix") {
    const { data: items, error } = await db.from("order_items").select("media_id, product_name, product_type").eq("order_id", order.id);
    if (error) return NextResponse.json({ error: "Não foi possível consultar os arquivos do pedido." }, { status: 500 });
    return NextResponse.json({ status: order.status, totalCents: order.total_cents, clientName: order.client_identifier,
      pixKey: order.pix_key_snapshot, whatsappUrl: whatsappLink(order.whatsapp_snapshot || "", `Olá! Sou ${order.client_identifier}. Pedido ${order.id}. Vou enviar o comprovante do Pix para conferência e liberação.`),
      items: items || [], links: order.status === "paid" || order.status === "fulfilled" ? (items || []).filter((i) => i.media_id && i.product_type !== "print").map((i) => ({ mediaId: i.media_id, url: `/api/downloads/${order.id}/arquivo/${i.media_id}` })) : [],
    });
  }
  if (order.status !== "paid" && order.status !== "fulfilled") return NextResponse.json({ error: "pedido ainda não confirmado" }, { status: 402 });
  const { data: items } = await db.from("order_items").select("media_id, products(type)").eq("order_id", order.id);
  const all = items?.some((i: any) => i.products?.type === "download_all");
  let ids: string[];
  if (all) { const { data: media } = await db.from("media").select("id").eq("gallery_id", order.gallery_id); ids = (media || []).map((m) => m.id); }
  else ids = (items || []).filter((i: any) => i.products?.type !== "print").map((i) => i.media_id).filter(Boolean) as string[];
  return NextResponse.json({ status: order.status, links: ids.map((id) => ({ mediaId: id, url: `/api/downloads/${order.id}/arquivo/${id}` })) });
}
