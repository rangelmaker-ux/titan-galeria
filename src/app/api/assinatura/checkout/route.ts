import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { PLANS, PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

/** Cria uma sessão de Checkout pra o FOTÓGRAFO assinar um plano da Titan
 * Galeria (mode "subscription" — diferente do /api/checkout, que é o
 * cliente final comprando fotos). */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { plano } = (await req.json()) as { plano?: PlanId };
  if (!plano || !(plano in PLANS)) {
    return NextResponse.json({ error: "plano inválido" }, { status: 400 });
  }

  const planDef = PLANS[plano];
  if (!planDef.stripePriceId) {
    return NextResponse.json(
      { error: "plano não configurado no Stripe ainda" },
      { status: 500 }
    );
  }

  const { data: fotografo } = await supabase
    .from("photographers")
    .select("id, stripe_customer_id, display_name")
    .eq("id", user.id)
    .single();

  if (!fotografo) {
    return NextResponse.json({ error: "fotógrafo não encontrado" }, { status: 404 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: fotografo.stripe_customer_id || undefined,
    customer_email: fotografo.stripe_customer_id ? undefined : user.email,
    line_items: [{ price: planDef.stripePriceId, quantity: 1 }],
    metadata: { photographerId: fotografo.id, plano },
    subscription_data: { metadata: { photographerId: fotografo.id, plano } },
    success_url: `${siteUrl}/painel/assinatura?sucesso=1`,
    cancel_url: `${siteUrl}/painel/assinatura?cancelado=1`,
  });

  return NextResponse.json({ url: session.url });
}
