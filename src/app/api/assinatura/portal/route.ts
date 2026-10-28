import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Gera um link pro Stripe Billing Portal, onde o fotógrafo gerencia ou
 * cancela a própria assinatura da Titan Galeria. */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { data: fotografo } = await supabase
    .from("photographers")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!fotografo?.stripe_customer_id) {
    return NextResponse.json(
      { error: "você ainda não tem uma assinatura ativa" },
      { status: 400 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: fotografo.stripe_customer_id,
    return_url: `${siteUrl}/painel/assinatura`,
  });

  return NextResponse.json({ url: session.url });
}
