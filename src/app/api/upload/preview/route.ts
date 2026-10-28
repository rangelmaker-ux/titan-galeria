import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { avatarKey, mediaKey, publicPreviewUrl, storePhotoPreview } from "@/lib/r2";

export const runtime = "nodejs";
const MAX_PREVIEW_BYTES = 3 * 1024 * 1024;
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const galleryId = z.string().uuid().safeParse(req.nextUrl.searchParams.get("galleryId"));
  const avatar = req.nextUrl.searchParams.get("kind") === "avatar";
  if ((!avatar && !galleryId.success) || req.headers.get("content-type")?.split(";")[0] !== "image/jpeg") {
    return NextResponse.json({ error: "prévia inválida" }, { status: 400 });
  }
  if (Number(req.headers.get("content-length")) > MAX_PREVIEW_BYTES) return NextResponse.json({ error: "A prévia deve ter até 3 MB." }, { status: 413 });
  if (!avatar && galleryId.success) {
    const { data: gallery } = await supabase.from("galleries").select("id").eq("id", galleryId.data).eq("photographer_id", user.id).single();
    if (!gallery) return NextResponse.json({ error: "galeria não encontrada" }, { status: 404 });
  }
  const reader = req.body?.getReader();
  if (!reader) return NextResponse.json({ error: "prévia vazia" }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PREVIEW_BYTES) { await reader.cancel(); return NextResponse.json({ error: "A prévia deve ter até 3 MB." }, { status: 413 }); }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    if (body.length < 3 || body[0] !== 0xff || body[1] !== 0xd8 || body[2] !== 0xff) return NextResponse.json({ error: "prévia JPEG inválida" }, { status: 400 });
    const key = avatar ? avatarKey(user.id, "avatar.jpg") : mediaKey(galleryId.success ? galleryId.data : "", "preview.jpg", "preview");
    await storePhotoPreview(key, body);
    if (avatar) {
      const publicUrl = publicPreviewUrl(key);
      const { data, error } = await supabase.from("photographers").update({ avatar_url: publicUrl }).eq("id", user.id).select("id").single();
      if (error || !data) return NextResponse.json({ error: "A foto foi enviada, mas não foi possível salvar o perfil. Tente novamente." }, { status: 500 });
      return NextResponse.json({ key, publicUrl });
    }
    return NextResponse.json({ key });
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar a prévia da foto. Tente novamente." }, { status: 502 });
  } finally { reader.releaseLock(); }
}
