import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";
import { deletePreview } from "@/lib/r2";
import { deleteDriveFolder } from "@/lib/drive";
import { getDriveAccount } from "@/lib/drive-account";

const coverSchema = z.object({
  mediaId: z.string().uuid().nullable(), opacity: z.number().int().min(0).max(100), position: z.number().int().min(0).max(100),
  title: z.string().trim().max(160), subtitle: z.string().trim().max(300), signature: z.string().trim().max(120),
  date: z.string().refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v)),
  titleFont: z.enum(["sans", "serif", "editorial", "mono", "cursive"]), textFont: z.enum(["sans", "serif", "editorial", "mono", "cursive"]),
});
const welcomeMessageSchema = z.object({
  title: z.string().trim().max(120),
  body: z.string().trim().max(600),
  font: z.enum(["sans", "serif", "editorial", "mono", "cursive"]),
});
const bodySchema = z.object({
  cover: coverSchema.optional(),
  welcomeMessage: welcomeMessageSchema.optional(),
  isPublished: z.boolean().optional(),
  allowFavorites: z.boolean().optional(),
  allowDownloads: z.boolean().optional(),
  watermarkPreviews: z.boolean().optional(),
  requireClientName: z.boolean().optional(),
  password: z.string().nullable().optional(), // null/"" remove a senha
  template: z.enum(["grid", "masonry", "minimal"]).optional(),
  realtimeMode: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  const {
    isPublished,
    allowFavorites,
    allowDownloads,
    watermarkPreviews,
    requireClientName,
    password,
    template,
    realtimeMode,
  } = parsed.data;

  const update: Record<string, unknown> = {};
  if (parsed.data.cover || parsed.data.welcomeMessage) {
    const { data: owned } = await supabase.from("galleries").select("id").eq("id", params.id).eq("photographer_id", user.id).is("deleted_at", null).single();
    if (!owned) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });
    if (parsed.data.cover?.mediaId) {
      const { data: photo } = await supabase.from("media").select("id").eq("id", parsed.data.cover.mediaId).eq("gallery_id", params.id).eq("type", "photo").single();
      if (!photo) return NextResponse.json({ error: "Escolha uma foto desta galeria para a capa." }, { status: 400 });
    }
  }
  if (parsed.data.cover) update.delivery_design = parsed.data.cover;
  if (parsed.data.welcomeMessage) update.welcome_message = parsed.data.welcomeMessage;
  if (isPublished !== undefined) update.is_published = isPublished;
  if (allowFavorites !== undefined) update.allow_favorites = allowFavorites;
  if (allowDownloads !== undefined) update.allow_downloads = allowDownloads;
  if (watermarkPreviews !== undefined) update.watermark_previews = watermarkPreviews;
  if (requireClientName !== undefined) update.require_client_name = requireClientName;
  if (template !== undefined) update.template = template;
  if (realtimeMode !== undefined) update.realtime_mode = realtimeMode;
  if (password !== undefined) {
    update.password_hash = password ? await bcrypt.hash(password, 10) : null;
  }

  const { error } = await supabase
    .from("galleries")
    .update(update)
    .eq("id", params.id)
    .eq("photographer_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/** Arquiva a galeria em vez de apagar a linha: um DELETE de verdade apagaria
 * em cascata os pedidos/pagamentos dela (constraint da migration 0001). A
 * galeria some do painel e do link público; a pasta no Drive e as prévias
 * no R2 (armazenamento, não registro financeiro) são excluídas de verdade,
 * em melhor esforço — se alguma falhar, a galeria já está arquivada e não
 * aparece mais pra ninguém, então não travamos a resposta por isso. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: galeria } = await supabase
    .from("galleries")
    .select("id, drive_folder_id")
    .eq("id", params.id)
    .eq("photographer_id", user.id)
    .is("deleted_at", null)
    .single();
  if (!galeria) return NextResponse.json({ error: "galeria não encontrada" }, { status: 404 });

  const { data: midias } = await supabase
    .from("media")
    .select("r2_key_preview")
    .eq("gallery_id", params.id);

  const { error } = await supabase
    .from("galleries")
    .update({ deleted_at: new Date().toISOString(), is_published: false })
    .eq("id", params.id)
    .eq("photographer_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // limpeza best-effort — não bloqueia a resposta se falhar.
  for (const m of midias ?? []) {
    if (m.r2_key_preview) deletePreview(m.r2_key_preview).catch(() => {});
  }
  if (galeria.drive_folder_id) {
    getDriveAccount(user.id)
      .then((account) => deleteDriveFolder(account, galeria.drive_folder_id!))
      .catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
