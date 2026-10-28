import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { whatsappLink } from "@/lib/order-access";
const schema = z.object({ pixKey: z.string().trim().min(1).max(200), whatsapp: z.string().trim().min(1).max(30).refine((phone) => !!whatsappLink(phone, ""), "Informe o WhatsApp com DDD e, se necessário, código do país.") });
export async function PATCH(req: NextRequest) {
  const db = createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 });
  const { data, error } = await db.from("photographers").update({ pix_key: body.data.pixKey, whatsapp: body.data.whatsapp }).eq("id", user.id).select("id").single();
  if (error || !data) return NextResponse.json({ error: "Não foi possível salvar os dados de recebimento." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
