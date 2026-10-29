import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { watermarkLogoKey, publicPreviewUrl, storePublicImage } from "@/lib/r2";

export const runtime = "nodejs";
const MAX_BYTES = 2 * 1024 * 1024;
const TIPOS_OK: Record<string, string> = { "image/png": "logo.png", "image/jpeg": "logo.jpg", "image/webp": "logo.webp" };

/** Sobe a logo que o fotógrafo usa como marca d'água nas prévias. Guarda o
 * arquivo como veio (sem recomprimir em canvas), pra não perder a
 * transparência de um PNG. */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const contentType = req.headers.get("content-type")?.split(";")[0] || "";
  const fileName = TIPOS_OK[contentType];
  if (!fileName) return NextResponse.json({ error: "Envie a logo em PNG, JPG ou WebP." }, { status: 400 });
  if (Number(req.headers.get("content-length")) > MAX_BYTES) {
    return NextResponse.json({ error: "A logo deve ter até 2 MB." }, { status: 413 });
  }

  const reader = req.body?.getReader();
  if (!reader) return NextResponse.json({ error: "arquivo vazio" }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "A logo deve ter até 2 MB." }, { status: 413 });
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    const key = watermarkLogoKey(user.id, fileName);
    await storePublicImage(key, body, contentType);
    const publicUrl = publicPreviewUrl(key);

    const { error } = await supabase.from("photographers").update({ watermark_logo_url: publicUrl }).eq("id", user.id);
    if (error) return NextResponse.json({ error: "A logo foi enviada, mas não foi possível salvar no perfil. Tente novamente." }, { status: 500 });

    return NextResponse.json({ publicUrl });
  } catch {
    return NextResponse.json({ error: "Não foi possível enviar a logo. Tente novamente." }, { status: 502 });
  } finally {
    reader.releaseLock();
  }
}
