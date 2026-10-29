import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// displayName/slug só são exigidos quando vêm no corpo (o formulário de
// marca d'água manda um PATCH com só os campos watermark*).
const bodySchema = z.object({
  displayName: z.string().min(1).optional(),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, "use só letras minúsculas, números e hífen")
    .optional(),
  bio: z.string().optional(),
  instagram: z.string().optional(),
  whatsapp: z.string().optional(),
  avatarUrl: z.union([z.string().url(), z.literal("")]).optional(),
  pixKey: z.string().optional(),
  watermarkLogoUrl: z.union([z.string().url(), z.literal("")]).optional(),
  watermarkPosX: z.number().min(0).max(100).optional(),
  watermarkPosY: z.number().min(0).max(100).optional(),
  watermarkScale: z.number().min(5).max(80).optional(),
  watermarkOpacity: z.number().min(5).max(100).optional(),
});

export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { displayName, slug, bio, instagram, whatsapp, avatarUrl, pixKey, watermarkLogoUrl, watermarkPosX, watermarkPosY, watermarkScale, watermarkOpacity } = parsed.data;

  const update: Record<string, unknown> = {};
  if (displayName !== undefined) update.display_name = displayName;
  if (slug !== undefined) update.slug = slug;
  if (bio !== undefined) update.bio = bio;
  if (instagram !== undefined) update.instagram = instagram;
  if (whatsapp !== undefined) update.whatsapp = whatsapp;
  if (avatarUrl !== undefined) update.avatar_url = avatarUrl || null;
  if (pixKey !== undefined) update.pix_key = pixKey || null;
  if (watermarkLogoUrl !== undefined) update.watermark_logo_url = watermarkLogoUrl || null;
  if (watermarkPosX !== undefined) update.watermark_pos_x = watermarkPosX;
  if (watermarkPosY !== undefined) update.watermark_pos_y = watermarkPosY;
  if (watermarkScale !== undefined) update.watermark_scale = watermarkScale;
  if (watermarkOpacity !== undefined) update.watermark_opacity = watermarkOpacity;

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "nada para salvar" }, { status: 400 });

  const { error } = await supabase.from("photographers").update(update).eq("id", user.id);

  if (error) {
    const msg = error.message.includes("duplicate") ? "esse endereço já está em uso" : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
