import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyPlanError } from "@/lib/plans";
const bodySchema = z.object({ type: z.enum(["download_single", "download_all", "print"]), name: z.string().trim().min(1).max(200), priceCents: z.number().int().positive().max(2147483647), printSize: z.string().max(100).optional(), galleryId: z.string().uuid() });
const patchSchema = z.object({ id: z.string().uuid(), active: z.boolean().optional(), galleryId: z.string().uuid().optional() });
export async function POST(req: NextRequest) {
  const db = createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confira os campos e selecione a galeria que contém os arquivos à venda." }, { status: 400 });
  const p = parsed.data;
  const { data: gallery } = await db.from("galleries").select("id").eq("id", p.galleryId).eq("photographer_id", user.id).single();
  if (!gallery) return NextResponse.json({ error: "galeria não encontrada" }, { status: 404 });
  const { error } = await db.from("products").insert({ photographer_id: user.id, gallery_id: p.galleryId, type: p.type, name: p.name, price_cents: p.priceCents, print_size: p.type === "print" ? p.printSize : null });
  if (error) return NextResponse.json({ error: friendlyPlanError(error.message) || "Não foi possível criar o produto." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
export async function PATCH(req: NextRequest) {
  const db = createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  const { id, active, galleryId } = parsed.data;
  if (galleryId) { const { data } = await db.from("galleries").select("id").eq("id", galleryId).eq("photographer_id", user.id).single(); if (!data) return NextResponse.json({ error: "galeria não encontrada" }, { status: 404 }); }
  const update = { ...(active !== undefined ? { active } : {}), ...(galleryId ? { gallery_id: galleryId } : {}) };
  const { data, error } = await db.from("products").update(update).eq("id", id).eq("photographer_id", user.id).is("deleted_at", null).select("id").single();
  if (error || !data) return NextResponse.json({ error: error ? friendlyPlanError(error.message) || "Não foi possível alterar o produto." : "produto não encontrado" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
export async function DELETE(req: NextRequest) {
  const db = createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "produto inválido" }, { status: 400 });
  const { data, error } = await db.from("products").update({ active: false, deleted_at: new Date().toISOString() }).eq("id", parsed.data.id).eq("photographer_id", user.id).select("id").single();
  if (error || !data) return NextResponse.json({ error: "Não foi possível excluir o produto." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
