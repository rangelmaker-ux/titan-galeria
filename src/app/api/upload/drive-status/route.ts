import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readUploadSession } from "@/lib/upload-session";
import { queryDriveUpload } from "@/lib/drive";
import { getDriveAccount } from "@/lib/drive-account";

const schema = z.object({ galleryId: z.string().uuid(), token: z.string().min(1).max(12000) });
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  const session = readUploadSession(parsed.data.token, user.id, parsed.data.galleryId);
  if (!session) return NextResponse.json({ error: "sessão de envio inválida ou expirada; selecione o arquivo novamente" }, { status: 400 });
  const { data: gallery } = await supabase.from("galleries").select("id").eq("id", session.galleryId).eq("photographer_id", user.id).single();
  if (!gallery) return NextResponse.json({ error: "galeria não encontrada" }, { status: 404 });
  try { const account = await getDriveAccount(user.id); return NextResponse.json(await queryDriveUpload(account, session.uploadUrl, session.sizeBytes)); }
  catch { return NextResponse.json({ error: "Não foi possível conferir o envio no Google Drive. Tente novamente sem fechar esta página." }, { status: 502 }); }
}
