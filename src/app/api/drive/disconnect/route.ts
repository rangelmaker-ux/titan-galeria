import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/** Desconecta o Drive do fotógrafo — volta a usar a conta do administrador
 * pros próximos envios. Não apaga nada que já foi enviado.
 * Usa o service_role porque drive_* não está liberado pro UPDATE direto do
 * fotógrafo (só o backend grava essas colunas — ver migration 0009). */
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const service = createServiceClient();
  await service
    .from("photographers")
    .update({ drive_refresh_token: null, drive_root_folder_id: null, drive_email: null, drive_connected_at: null })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
