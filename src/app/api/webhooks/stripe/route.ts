import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";

// Stripe exige o corpo bruto (não parseado) pra validar a assinatura.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return NextResponse.json({ error: `assinatura inválida: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const orderId = session.metadata?.orderId;
    if (orderId) {
      const supabase = createServiceClient();
      await supabase
        .from("orders")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", orderId);
    }
  }

  return NextResponse.json({ received: true });
}
