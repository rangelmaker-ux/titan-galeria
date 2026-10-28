import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createUploadUrl, avatarKey, publicPreviewUrl } from "@/lib/r2";

const bodySchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().startsWith("image/"),
});

/** Gera uma URL assinada pro fotógrafo subir a própria foto de perfil
 * direto pro bucket público do R2 (sem passar pelo servidor). */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  const { fileName, contentType } = parsed.data;

  const key = avatarKey(user.id, fileName);
  const uploadUrl = await createUploadUrl(key, contentType, "preview");

  return NextResponse.json({ uploadUrl, publicUrl: publicPreviewUrl(key) });
}
