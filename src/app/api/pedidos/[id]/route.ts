import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
const schema = z.object({ action: z.enum(["confirm", "cancel"]) });
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success || !z.string().uuid().safeParse(params.id).success) return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  const { data: order } = await db.from("orders").select("id, gallery_id, status, payment_method").eq("id", params.id).single();
  if (!order) return NextResponse.json({ error: "pedido não encontrado" }, { status: 404 });
  const { data: gallery } = await db.from("galleries").select("id").eq("id", order.gallery_id).eq("photographer_id", user.id).single();
  if (!gallery || order.payment_method !== "manual_pix") return NextResponse.json({ error: "pedido não disponível para aprovação manual" }, { status: 403 });
  const target = body.data.action === "confirm" ? "paid" : "canceled";
  if (order.status === target) return NextResponse.json({ ok: true });
  if (order.status !== "pending") return NextResponse.json({ error: "este pedido já foi processado" }, { status: 409 });
  const { data, error } = await createServiceClient().from("orders").update({ status: target, approved_by: user.id, ...(target === "paid" ? { paid_at: new Date().toISOString() } : {}) })
    .eq("id", order.id).eq("status", "pending").select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Não foi possível atualizar o pedido. Atualize a página." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
