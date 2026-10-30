import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { BILLING_OPTIONS, BillingInterval } from "@/lib/plans";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Cria uma sessão de Checkout pra o FOTÓGRAFO assinar a Titan Galeria
 * (mode "subscription" — diferente do /api/checkout, que é o cliente
 * final comprando fotos). Só existe um plano; o que varia é a cadência de
 * cobrança (mensal/trimestral/anual). */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isAdmin(user)) return NextResponse.json({ url: "/painel/assinatura" });
  const body = (await req.json().catch(() => null)) || {};
  const { intervalo } = body as { intervalo?: BillingInterval };
  const emailResult = z.string().trim().email().max(254).safeParse(user?.email || body.email);
  if (!emailResult.success) return NextResponse.json({ error: "Informe o e-mail que receberá o acesso à Titan Galeria." }, { status: 400 });
  const purchaseEmail = emailResult.data.toLowerCase();
  if (!intervalo || !Object.prototype.hasOwnProperty.call(BILLING_OPTIONS, intervalo)) {
    return NextResponse.json({ error: "cadência de cobrança inválida" }, { status: 400 });
  }

  const planDef = BILLING_OPTIONS[intervalo];

  const { data: fotografo } = user ? await supabase.from("photographers")
    .select("id, stripe_customer_id, display_name, subscription_status, plan_source, manual_plan")
    .eq("id", user.id).single() : { data: null };

  if (user && !fotografo) {
    return NextResponse.json({ error: "fotógrafo não encontrado" }, { status: 404 });
  }

  if (fotografo?.manual_plan === "titan" || fotografo?.plan_source === "admin") {
    return NextResponse.json({ error: "Seu plano já foi liberado pela administração. Não é necessário iniciar outra assinatura." }, { status: 409 });
  }
  if (!planDef.stripePriceId) return NextResponse.json({ error: "plano não configurado no Stripe ainda" }, { status: 500 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Trocas devem atualizar a assinatura existente, sem criar outra cobrança.
  if (fotografo && ["active", "trialing", "past_due", "unpaid"].includes(fotografo.subscription_status)) {
    if (!fotografo.stripe_customer_id) {
      return NextResponse.json({ error: "assinatura sem vínculo de cobrança; contate o suporte" }, { status: 409 });
    }
    const portal = await stripe.billingPortal.sessions.create({
      customer: fotografo.stripe_customer_id,
      return_url: `${siteUrl}/painel/assinatura`,
    });
    return NextResponse.json({ url: portal.url });
  }

  // Prevent a second subscription when an email already paid before registering.
  const pending = await stripe.customers.list({ email: purchaseEmail, limit: 100 });
  if (pending.has_more) return NextResponse.json({ error: "Entre na sua conta para conferir as assinaturas deste e-mail." }, { status: 409 });
  for (const customer of pending.data) {
    const subscriptions = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 100 });
    if (subscriptions.has_more || subscriptions.data.some((subscription) => ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(subscription.status) && subscription.items.data.some((item) => Object.values(BILLING_OPTIONS).some((option) => option.stripePriceId && option.stripePriceId === item.price.id)))) {
      return NextResponse.json({ error: "Este e-mail já tem uma assinatura ou pagamento em andamento. Entre ou crie sua conta com esse mesmo e-mail para consultar o acesso; não é necessário comprar novamente." }, { status: 409 });
    }
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: purchaseEmail,
    line_items: [{ price: planDef.stripePriceId, quantity: 1 }],
    metadata: { ...(user ? { photographerId: user.id } : {}), plano: "titan", intervalo },
    subscription_data: { metadata: { ...(user ? { photographerId: user.id } : {}), plano: "titan", intervalo } },
    success_url: user ? `${siteUrl}/painel/assinatura?sucesso=1` : `${siteUrl}/entrar?compra=confirmada`,
    cancel_url: user ? `${siteUrl}/painel/assinatura?cancelado=1` : `${siteUrl}/assinar`,
  });

  return NextResponse.json({ url: session.url });
}
