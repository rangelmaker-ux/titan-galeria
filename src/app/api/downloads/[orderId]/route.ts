import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { createServiceClient } from "@/lib/supabase/server";
import { canReadOrder, whatsappLink } from "@/lib/order-access";
import { buildPixPayload } from "@/lib/pix";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const db = createServiceClient();
  const { data: order } = await db.from("orders").select("id, status, gallery_id, payment_method, access_token_hash, client_identifier, total_cents, pix_key_snapshot, whatsapp_snapshot").eq("id", params.orderId).single();
  if (!order) return NextResponse.json({ error: "pedido não encontrado" }, { status: 404 });
  if (!canReadOrder(req, order)) return NextResponse.json({ error: "Abra o pedido no mesmo navegador em que ele foi criado." }, { status: 403 });
  if (order.payment_method === "manual_pix") {
    const { data: items, error } = await db.from("order_items").select("media_id, product_name, product_type").eq("order_id", order.id);
    if (error) return NextResponse.json({ error: "Não foi possível consultar os arquivos do pedido." }, { status: 500 });

    // Nome e foto de quem recebe o Pix, pra exibir no checkout junto com a
    // chave e o QR Code — reaproveita o mesmo perfil público do fotógrafo.
    const { data: galeria } = await db.from("galleries").select("photographer_id").eq("id", order.gallery_id).single();
    const { data: fotografo } = galeria
      ? await db.from("photographers").select("display_name, avatar_url").eq("id", galeria.photographer_id).single()
      : { data: null };

    let pixPayload: string | null = null;
    let pixQrDataUrl: string | null = null;
    if (order.pix_key_snapshot && order.total_cents > 0) {
      try {
        pixPayload = buildPixPayload({
          pixKey: order.pix_key_snapshot,
          merchantName: fotografo?.display_name || "Titan Galeria",
          amountCents: order.total_cents,
          txid: order.id,
        });
        pixQrDataUrl = await QRCode.toDataURL(pixPayload, { margin: 1, width: 320 });
      } catch { /* QR é só um extra visual — a chave em texto já basta pra pagar */ }
    }

    return NextResponse.json({ status: order.status, totalCents: order.total_cents, clientName: order.client_identifier,
      pixKey: order.pix_key_snapshot, pixPayload, pixQrDataUrl,
      merchantName: fotografo?.display_name || null, merchantAvatarUrl: fotografo?.avatar_url || null,
      whatsappUrl: whatsappLink(order.whatsapp_snapshot || "", `Olá! Sou ${order.client_identifier}. Pedido ${order.id}. Vou enviar o comprovante do Pix para conferência e liberação.`),
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
