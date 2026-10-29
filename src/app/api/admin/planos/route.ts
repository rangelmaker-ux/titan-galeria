import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
const schema = z.object({ photographerId: z.string().uuid(), plan: z.enum(["gratuito","titan"]).nullable() });
export async function PATCH(req: NextRequest) {
  const db = createClient(); const { data: { user } } = await db.auth.getUser();
  if (!isAdmin(user)) return NextResponse.json({ error: "acesso restrito ao administrador" }, { status: 403 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  if (body.data.photographerId === user!.id) return NextResponse.json({ error: "Seu acesso de administrador é permanente e não pode ser removido." }, { status: 400 });
  const { error } = await createServiceClient().rpc("admin_grant_plan", { target_id: body.data.photographerId, actor_id: user!.id, granted_plan: body.data.plan });
  if (error) return NextResponse.json({ error: "Não foi possível alterar o plano desta conta." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
