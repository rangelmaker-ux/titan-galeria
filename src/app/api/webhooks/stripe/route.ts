import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { planFromStripePriceId } from "@/lib/plans";

// Stripe exige o corpo bruto (não parseado) pra validar a assinatura.
export const runtime = "nodejs";

/** Mapeia o status de assinatura do Stripe pro enum que usamos em
 * photographers.subscription_status. */
function mapSubscriptionStatus(stripeStatus: string): string {
  const validos = ["inactive", "trialing", "active", "past_due", "canceled", "unpaid"];
  if (stripeStatus === "incomplete" || stripeStatus === "incomplete_expired") return "inactive";
  return validos.includes(stripeStatus) ? stripeStatus : "inactive";
}

async function syncSubscription(subscription: any) {
  const supabase = createServiceClient();
  const priceId = subscription.items?.data?.[0]?.price?.id as string | undefined;
  const plano = planFromStripePriceId(priceId);
  const photographerId = subscription.metadata?.photographerId as string | undefined;

  const update: Record<string, any> = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer,
    subscription_status: mapSubscriptionStatus(subscription.status),
    subscription_current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
  };
  if (plano) update.plan = plano;

  let query = supabase.from("photographers").update(update);
  query = photographerId
    ? query.eq("id", photographerId)
    : query.eq("stripe_customer_id", subscription.customer);

  await query;
}

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

    if (session.mode === "subscription") {
      // assinatura da Titan Galeria (fotógrafo pagando a plataforma) —
      // grava o customer id na hora; os detalhes do plano/status chegam
      // pelo customer.subscription.updated logo em seguida.
      const photographerId = session.metadata?.photographerId;
      if (photographerId && session.customer) {
        const supabase = createServiceClient();
        await supabase
          .from("photographers")
          .update({ stripe_customer_id: session.customer })
          .eq("id", photographerId);
      }
    } else {
      // checkout avulso — cliente final comprando fotos/prints.
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const supabase = createServiceClient();
        await supabase
          .from("orders")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", orderId);
      }
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created"
  ) {
    await syncSubscription(event.data.object as any);
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as any;
    const supabase = createServiceClient();
    await supabase
      .from("photographers")
      .update({ subscription_status: "canceled", plan: "gratuito" })
      .eq("stripe_customer_id", subscription.customer);
  }

  return NextResponse.json({ received: true });
}
