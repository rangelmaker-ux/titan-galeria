import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ensureDriveRoot, getDriveAccountEmail } from "@/lib/drive";

/** Volta do consentimento do Google: troca o code por um refresh_token,
 * cria a pasta "Titan Galeria" na raiz do Drive do fotógrafo e salva tudo
 * em photographers.drive_*. Depois disso, os uploads dele passam a ir pro
 * próprio Drive em vez da conta do administrador. */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/entrar", req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = cookies().get("titan_drive_oauth_state")?.value;
  cookies().delete("titan_drive_oauth_state");

  if (url.searchParams.get("error")) {
    return NextResponse.redirect(new URL("/painel/configuracoes?drive=cancelado", req.url));
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/painel/configuracoes?drive=erro", req.url));
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/drive/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) throw new Error(await tokenRes.text());
    const tokenData = await tokenRes.json();
    const refreshToken = tokenData.refresh_token as string | undefined;
    if (!refreshToken) {
      // o Google só devolve refresh_token na primeira autorização (ou com
      // prompt=consent, que já estamos forçando) — se ainda assim não vier,
      // peça pro fotógrafo revogar o acesso em myaccount.google.com e tentar de novo.
      return NextResponse.redirect(new URL("/painel/configuracoes?drive=sem_refresh_token", req.url));
    }

    const [rootFolderId, email] = await Promise.all([
      ensureDriveRoot(refreshToken),
      getDriveAccountEmail(refreshToken),
    ]);

    const service = createServiceClient();
    const { error: updateError } = await service
      .from("photographers")
      .update({
        drive_refresh_token: refreshToken,
        drive_root_folder_id: rootFolderId,
        drive_email: email,
        drive_connected_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // Se o UPDATE falhar (ex: colunas drive_* não existem ainda porque a
    // migration 0009 não foi aplicada), NÃO pode redirecionar como sucesso —
    // senão o fotógrafo acha que conectou o próprio Drive, mas nada foi
    // salvo, e os próximos envios continuam caindo silenciosamente na conta
    // do administrador.
    if (updateError) {
      console.error("[drive/callback] falha ao salvar credenciais do Drive", user.id, updateError.message);
      return NextResponse.redirect(new URL("/painel/configuracoes?drive=erro_salvar", req.url));
    }

    return NextResponse.redirect(new URL("/painel/configuracoes?drive=conectado", req.url));
  } catch {
    return NextResponse.redirect(new URL("/painel/configuracoes?drive=erro", req.url));
  }
}
