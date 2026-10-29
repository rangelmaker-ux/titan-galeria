import { createServiceClient } from "./supabase/server";
import type { DriveAccount } from "./drive";

/** Busca as credenciais do Drive de um fotógrafo específico. Se ele ainda
 * não conectou o próprio Drive, volta tudo nulo — as funções de drive.ts
 * caem no fallback da conta do administrador nesse caso. */
export async function getDriveAccount(photographerId: string): Promise<DriveAccount> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("photographers")
    .select("drive_refresh_token, drive_root_folder_id")
    .eq("id", photographerId)
    .single();
  return { refreshToken: data?.drive_refresh_token ?? null, rootFolderId: data?.drive_root_folder_id ?? null };
}
