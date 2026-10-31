import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

/** Desconecta o Drive de TODOS os fotógrafos de uma vez, forçando
 * reconexão de todo mundo — usado uma única vez depois do conserto do bug
 * em drive-account.ts, pra garantir que ninguém fique com uma conexão
 * "fantasma" (marcada como conectada, mas que nunca funcionou de verdade
 * por causa do bug). Não apaga nada que já foi enviado nem exclui pastas
 * no Drive — só limpa as credenciais salvas, igual o botão "Desconectar"
 * em /painel/configuracoes faz pra um fotógrafo só. Só o admin pode chamar. */
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user)) return NextResponse.json({ error: "não autorizado" }, { status: 403 });

  const service = createServiceClient();

  // pega o e-mail de cada um ANTES de limpar — é o que você vai usar pra
  // achar e apagar as pastas certas no seu Drive depois.
  const { data: antes } = await service
    .from("photographers")
    .select("id, display_name, drive_email")
    .not("drive_refresh_token", "is", null);

  const { error } = await service
    .from("photographers")
    .update({ drive_refresh_token: null, drive_root_folder_id: null, drive_email: null, drive_connected_at: null })
    .not("drive_refresh_token", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, desconectados: antes?.length ?? 0, quem: antes ?? [] });
}
