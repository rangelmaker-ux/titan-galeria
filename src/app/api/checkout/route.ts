import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { orderCookieName, orderTokenHash, whatsappLink } from "@/lib/order-access";

const bodySchema = z.object({
  shareToken: z.string().min(1), productId: z.string().uuid(),
  mediaIds: z.array(z.string().uuid()).max(500).default([]),
  clientIdentifier: z.string().trim().min(3).max(200).refine((name) => name.split(/\s+/).length >= 2, "Informe seu nome completo como aparece no Pix."),
  clientEmail: z.string().email().optional(),
  requestId: z.string().uuid(), accessToken: z.string().regex(/^[a-f0-9]{64}$/),
});
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { shareToken, productId, clientIdentifier, clientEmail, requestId, accessToken } = parsed.data;
  const supabase = createServiceClient();
  const { data: galeria } = await supabase.from("galleries").select("id, title, photographer_id, password_hash").eq("share_token", shareToken).is("deleted_at", null).single();
  if (!galeria) return NextResponse.json({ error: "galeria não encontrada" }, { status: 404 });
  if (galeria.password_hash && req.cookies.get(`g_${shareToken}_ok`)?.value !== "1") return NextResponse.json({ error: "desbloqueie a galeria primeiro" }, { status: 403 });
  const { data: produto } = await supabase.from("products").select("id, name, price_cents, currency, type, active")
    .eq("id", productId).eq("photographer_id", galeria.photographer_id).eq("gallery_id", galeria.id).is("deleted_at", null).single();
  if (!produto?.active || produto.currency.toLowerCase() !== "brl" || produto.price_cents <= 0) return NextResponse.json({ error: "produto indisponível nesta galeria" }, { status: 400 });
  const { data: fotografo } = await supabase.from("photographers").select("pix_key, whatsapp").eq("id", galeria.photographer_id).single();
  if (!fotografo?.pix_key?.trim() || !fotografo.whatsapp || !whatsappLink(fotografo.whatsapp, "")) return NextResponse.json({ error: "O profissional ainda precisa cadastrar a chave Pix e o WhatsApp para receber pedidos." }, { status: 409 });
  const selected = [...new Set(parsed.data.mediaIds)];
  if (produto.type !== "download_all" && !selected.length) return NextResponse.json({ error: "selecione os arquivos que deseja comprar" }, { status: 400 });
  let query = supabase.from("media").select("id, type").eq("gallery_id", galeria.id);
  if (produto.type !== "download_all") query = query.in("id", selected);
  const { data: media, error: mediaError } = await query;
  if (mediaError) return NextResponse.json({ error: "Não foi possível conferir os arquivos." }, { status: 500 });
  if (!media?.length || media.length > 500 || (produto.type !== "download_all" && media.length !== selected.length)) return NextResponse.json({ error: "seleção inválida; confira os arquivos desta galeria" }, { status: 400 });
  if (produto.type === "print" && media.some((m) => m.type !== "photo")) return NextResponse.json({ error: "A impressão está disponível apenas para fotos." }, { status: 400 });
  const total = produto.price_cents * (produto.type === "download_all" ? 1 : media.length);
  if (!Number.isSafeInteger(total) || total > 2147483647) return NextResponse.json({ error: "valor do pedido inválido" }, { status: 400 });
  const items = media.map((m, index) => ({ product_id: produto.id, media_id: m.id, product_name: produto.name,
    product_type: produto.type, unit_price_cents: produto.type === "download_all" && index > 0 ? 0 : produto.price_cents }));
  const { data: orderId, error } = await supabase.rpc("create_manual_order", { order_data: {
    gallery_id: galeria.id, client_identifier: clientIdentifier, client_email: clientEmail || null,
    total_cents: total, access_token_hash: orderTokenHash(accessToken), client_request_id: requestId,
    pix_key_snapshot: fotografo.pix_key.trim(), whatsapp_snapshot: fotografo.whatsapp,
  }, items_data: items });
  if (error || !orderId) return NextResponse.json({ error: "Não foi possível registrar seu pedido. Tente novamente." }, { status: 500 });
  // Lê o valor original também nos reenvios idempotentes.
  const { data: order } = await supabase.from("orders").select("id, total_cents, pix_key_snapshot, whatsapp_snapshot, client_identifier").eq("id", orderId).single();
  if (!order) return NextResponse.json({ error: "Pedido registrado. Tente novamente para consultar os dados." }, { status: 500 });
  const response = NextResponse.json({ orderId: order.id, totalCents: order.total_cents, pixKey: order.pix_key_snapshot,
    whatsappUrl: whatsappLink(order.whatsapp_snapshot, `Olá! Sou ${order.client_identifier}. Pedido ${order.id} da galeria ${galeria.title}. Vou enviar o comprovante do Pix para conferência e liberação dos arquivos.`) });
  response.cookies.set(orderCookieName(order.id), accessToken, { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", path: `/api/downloads/${order.id}`, maxAge: 90 * 24 * 60 * 60 });
  return response;
}
