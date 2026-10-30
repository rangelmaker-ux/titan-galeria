import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { planFromStripePriceId, billingIntervalFromStripePriceId } from "@/lib/plans";

// Stripe exige o corpo bruto (não parseado) pra validar a assinatura.
export const runtime = "nodejs";

/** Mapeia o status de assinatura do Stripe pro enum que usamos em
 * photographers.subscription_status. */
function mapSubscriptionStatus(stripeStatus: string): string {
  const validos = ["inactive", "trialing", "active", "past_due", "canceled", "unpaid"];
  if (stripeStatus === "incomplete" || stripeStatus === "incomplete_expired") return "inactive";
  return validos.includes(stripeStatus) ? stripeStatus : "inactive";
}

function objectId(value: any): string | undefined { return typeof value === "string" ? value : value?.id; }
async function syncSubscription(id: string, eventCreated: number, emailHint?: string) {
  // Read current Stripe state so a late/replayed webhook cannot restore canceled access.
  const subscription = await stripe.subscriptions.retrieve(id, { expand: ["latest_invoice", "customer"] });
  const customer = subscription.customer as any;
  const customerId = objectId(customer);
  const email = (emailHint || customer.email || "").trim().toLowerCase();
  const priceId = subscription.items.data[0]?.price.id;
  if (!planFromStripePriceId(priceId)) return; // Ignore unrelated Stripe products.
  if (!email || !customerId) throw new Error("missing_billing_email");
  const invoice = subscription.latest_invoice as any;
  const invoicePaid = invoice && typeof invoice !== "string" && invoice.status === "paid" && invoice.paid === true;
  const periodEnd = subscription.current_period_end;
  const paidUntil = invoicePaid && subscription.status === "active" && periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
  const { error } = await createServiceClient().rpc("sync_titan_subscription", { payload: {
    subscriptionId: subscription.id, customerId, email,
    status: mapSubscriptionStatus(subscription.status), paidUntil,
    interval: billingIntervalFromStripePriceId(priceId), eventCreated,
  } });
  if (error) throw new Error("billing_sync_failed");
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

  try {
    const object = event.data.object as any;
    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type) && object.mode === "subscription" && object.payment_status === "paid") {
      const id = objectId(object.subscription);
      if (id) await syncSubscription(id, event.created, object.customer_details?.email || object.customer_email);
    }
    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      await syncSubscription(object.id, event.created);
    }
    if (["invoice.paid", "invoice.payment_failed"].includes(event.type)) {
      const id = objectId(object.subscription || object.parent?.subscription_details?.subscription);
      if (id) await syncSubscription(id, event.created);
    }
  } catch {
    return NextResponse.json({ error: "Não foi possível sincronizar o acesso. O Stripe tentará novamente." }, { status: 500 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    if (session.mode === "payment" && session.payment_status === "paid") {
      // Concluir o checkout não significa que um pagamento pendente foi pago.
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const supabase = createServiceClient();
        const { error } = await supabase
          .from("orders")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", orderId)
          .eq("payment_method", "stripe")
          .in("status", ["pending", "canceled"]);
        if (error) {
          return NextResponse.json({ error: "não foi possível confirmar o pedido" }, { status: 500 });
        }
      }
    }
  }

  if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
    const session = event.data.object;
    if (session.mode === "payment" && session.metadata?.orderId) {
      const { error } = await createServiceClient()
        .from("orders")
        .update({ status: "canceled" })
        .eq("id", session.metadata.orderId)
        .eq("payment_method", "stripe")
        .eq("status", "pending");
      if (error) return NextResponse.json({ error: "não foi possível atualizar o pedido" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
