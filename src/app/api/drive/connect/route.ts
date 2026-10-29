import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/** Primeiro passo pra cada fotógrafo conectar o PRÓPRIO Google Drive —
 * pede só o escopo "drive.file" (a plataforma só acessa o que ela mesma
 * cria: a pasta "Titan Galeria" e o que for enviado nela), então não
 * precisa passar pela verificação pesada do Google pra apps com acesso
 * total ao Drive. */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/entrar", req.url));

  const state = crypto.randomUUID();
  cookies().set("titan_drive_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/drive/callback`;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: "https://www.googleapis.com/auth/drive.file",
    state,
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
