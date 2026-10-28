import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  isPublished: z.boolean().optional(),
  allowFavorites: z.boolean().optional(),
  allowDownloads: z.boolean().optional(),
  watermarkPreviews: z.boolean().optional(),
  password: z.string().nullable().optional(), // null/"" remove a senha
  template: z.enum(["grid", "masonry", "minimal"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  const { isPublished, allowFavorites, allowDownloads, watermarkPreviews, password, template } =
    parsed.data;

  const update: Record<string, unknown> = {};
  if (isPublished !== undefined) update.is_published = isPublished;
  if (allowFavorites !== undefined) update.allow_favorites = allowFavorites;
  if (allowDownloads !== undefined) update.allow_downloads = allowDownloads;
  if (watermarkPreviews !== undefined) update.watermark_previews = watermarkPreviews;
  if (template !== undefined) update.template = template;
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
