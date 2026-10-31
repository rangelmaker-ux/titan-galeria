import { createServiceClient } from "./supabase/server";
import type { DriveAccount } from "./drive";

/** Busca as credenciais do Drive de um fotógrafo específico. Se ele ainda
 * não conectou o próprio Drive, volta tudo nulo — as funções de drive.ts
 * caem no fallback da conta do administrador nesse caso.
 *
 * Importante: se a CONSULTA falhar (ex: colunas drive_* ainda não existem
 * porque a migration 0009 não foi aplicada no banco), isso NÃO pode ser
 * tratado como "fotógrafo não conectou" — senão todo fotógrafo cai no
 * fallback do admin silenciosamente, mesmo tendo conectado o próprio Drive.
 * Por isso agora checamos o erro e avisamos no log em vez de engolir. */
export async function getDriveAccount(photographerId: string): Promise<DriveAccount> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("photographers")
    .select("drive_refresh_token, drive_root_folder_id")
    .eq("id", photographerId)
    .single();
  if (error) {
    console.error("[drive-account] falha ao buscar credenciais do fotógrafo", photographerId, error.message);
    throw new Error("não foi possível verificar a conexão do Drive deste fotógrafo — rode a migration 0009 no Supabase se ainda não rodou");
  }
  return { refreshToken: data?.drive_refresh_token ?? null, rootFolderId: data?.drive_root_folder_id ?? null };
}
