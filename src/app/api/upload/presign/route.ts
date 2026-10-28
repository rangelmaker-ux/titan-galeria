import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createUploadUrl, mediaKey } from "@/lib/r2";

const bodySchema = z.object({
  galleryId: z.string().uuid(),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  variant: z.enum(["original", "preview"]),
});

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  }
  const { galleryId, fileName, contentType, variant } = parsed.data;

  // confere que a galeria é do fotógrafo logado (RLS também bloqueia, isso é
  // só pra devolver um erro mais claro).
  const { data: gallery } = await supabase
    .from("galleries")
    .select("id")
    .eq("id", galleryId)
    .eq("photographer_id", user.id)
    .single();
  if (!gallery) return NextResponse.json({ error: "galeria não encontrada" }, { status: 404 });

  const key = mediaKey(galleryId, fileName, variant);
  const uploadUrl = await createUploadUrl(key, contentType, variant);

  return NextResponse.json({ uploadUrl, key });
}
