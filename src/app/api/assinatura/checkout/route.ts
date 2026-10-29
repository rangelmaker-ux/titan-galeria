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

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  if (isAdmin(user)) return NextResponse.json({ url: "/painel/assinatura" });
  const { intervalo } = ((await req.json().catch(() => null)) || {}) as { intervalo?: BillingInterval };
  if (!intervalo || !Object.prototype.hasOwnProperty.call(BILLING_OPTIONS, intervalo)) {
    return NextResponse.json({ error: "cadência de cobrança inválida" }, { status: 400 });
  }

  const planDef = BILLING_OPTIONS[intervalo];

  const { data: fotografo } = await supabase
    .from("photographers")
    .select("id, stripe_customer_id, display_name, subscription_status, plan_source")
    .eq("id", user.id)
    .single();

  if (!fotografo) {
    return NextResponse.json({ error: "fotógrafo não encontrado" }, { status: 404 });
  }

  if (fotografo.plan_source === "manual" || fotografo.plan_source === "admin") {
    return NextResponse.json({ error: "Seu plano já foi liberado pela administração. Não é necessário iniciar outra assinatura." }, { status: 409 });
  }
  if (!planDef.stripePriceId) return NextResponse.json({ error: "plano não configurado no Stripe ainda" }, { status: 500 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Trocas devem atualizar a assinatura existente, sem criar outra cobrança.
  if (["active", "trialing", "past_due", "unpaid"].includes(fotografo.subscription_status)) {
    if (!fotografo.stripe_customer_id) {
      return NextResponse.json({ error: "assinatura sem vínculo de cobrança; contate o suporte" }, { status: 409 });
    }
    const portal = await stripe.billingPortal.sessions.create({
      customer: fotografo.stripe_customer_id,
      return_url: `${siteUrl}/painel/assinatura`,
    });
    return NextResponse.json({ url: portal.url });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: fotografo.stripe_customer_id || undefined,
    customer_email: fotografo.stripe_customer_id ? undefined : user.email,
    line_items: [{ price: planDef.stripePriceId, quantity: 1 }],
    metadata: { photographerId: fotografo.id, plano: "titan", intervalo },
    subscription_data: { metadata: { photographerId: fotografo.id, plano: "titan", intervalo } },
    success_url: `${siteUrl}/painel/assinatura?sucesso=1`,
    cancel_url: `${siteUrl}/painel/assinatura?cancelado=1`,
  });

  return NextResponse.json({ url: session.url });
}
