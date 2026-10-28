import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

const bodySchema = z.object({
  shareToken: z.string().min(1),
  productId: z.string().uuid(),
  mediaId: z.string().uuid().optional(), // obrigatório pra download_single/print
  clientIdentifier: z.string().min(1).max(200),
  clientEmail: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  const { shareToken, productId, mediaId, clientIdentifier, clientEmail } = parsed.data;

  const { data: galeria } = await supabase
    .from("galleries")
    .select("id, title, photographer_id")
    .eq("share_token", shareToken)
    .single();
  if (!galeria) return NextResponse.json({ error: "galeria não encontrada" }, { status: 404 });

  const { data: produto } = await supabase
    .from("products")
    .select("id, name, price_cents, currency, type, active")
    .eq("id", productId)
    .eq("photographer_id", galeria.photographer_id)
    .single();
  if (!produto || !produto.active) {
    return NextResponse.json({ error: "produto indisponível" }, { status: 404 });
  }
  if ((produto.type === "download_single" || produto.type === "print") && !mediaId) {
    return NextResponse.json({ error: "selecione uma foto" }, { status: 400 });
  }
  if (mediaId && produto.type !== "download_all") {
    const { data: media } = await supabase.from("media").select("id")
      .eq("id", mediaId).eq("gallery_id", galeria.id).single();
    if (!media) return NextResponse.json({ error: "foto não encontrada nesta galeria" }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      gallery_id: galeria.id,
      client_identifier: clientIdentifier,
      client_email: clientEmail,
      total_cents: produto.price_cents,
      currency: produto.currency,
    })
    .select("id")
    .single();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 400 });

  const { error: itemError } = await supabase.from("order_items").insert({
    order_id: order.id,
    product_id: produto.id,
    media_id: produto.type === "download_all" ? null : mediaId,
    unit_price_cents: produto.price_cents,
  });
  if (itemError) {
    await supabase.from("orders").update({ status: "canceled" }).eq("id", order.id);
    return NextResponse.json({ error: "não foi possível preparar o pedido" }, { status: 500 });
  }

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    // Métodos dinâmicos: habilite Pix no Dashboard para contas elegíveis.
    line_items: [
      {
        price_data: {
          currency: produto.currency,
          unit_amount: produto.price_cents,
          product_data: { name: `${produto.name} — ${galeria.title}` },
        },
        quantity: 1,
      },
    ],
    customer_email: clientEmail,
    success_url: `${origin}/g/${shareToken}?pedido=sucesso&orderId=${order.id}`,
    cancel_url: `${origin}/g/${shareToken}?pedido=cancelado`,
    metadata: { orderId: order.id },
  });

  await supabase
    .from("orders")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", order.id);

  return NextResponse.json({ checkoutUrl: session.url });
}
