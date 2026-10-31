import { fetchDriveFileStream, getDriveFileMeta } from "./drive";
import { getDriveAccount } from "./drive-account";
import { publicPreviewUrl, createDownloadUrl } from "./r2";

export type DownloadableMedia = {
  id: string;
  drive_file_id: string | null;
  r2_key_preview: string | null;
  r2_key_original: string | null;
};

export type ResolvedDownload =
  | { url: string }
  | { stream: ReadableStream<Uint8Array>; fileName: string; mimeType: string; size?: string };

/** Resolve pra onde baixar uma mídia de uma galeria com download liberado
 * (allow_downloads = true), seguindo a MESMA regra do download de pedidos
 * pagos (ver api/downloads/[orderId]/arquivo/[mediaId]): marca d'água
 * ligada = só a prévia (com marca); desligada = original em alta resolução,
 * sem marca — lido do estado ATUAL da galeria, nunca de algo fixado por
 * foto no envio. */
export async function resolveGalleryDownload(
  midia: DownloadableMedia,
  watermarkOn: boolean,
  photographerId: string
): Promise<ResolvedDownload | null> {
  if (watermarkOn) {
    if (!midia.r2_key_preview) return null;
    return { url: publicPreviewUrl(midia.r2_key_preview) };
  }
  if (!midia.drive_file_id) {
    // mídia antiga, enviada antes da migração pro Drive — ainda no R2.
    if (!midia.r2_key_original) return null;
    return { url: await createDownloadUrl(midia.r2_key_original) };
  }
  const account = await getDriveAccount(photographerId);
  const [meta, fileRes] = await Promise.all([
    getDriveFileMeta(account, midia.drive_file_id),
    fetchDriveFileStream(account, midia.drive_file_id),
  ]);
  if (!fileRes.body) return null;
  return {
    stream: fileRes.body,
    fileName: meta.name || `${midia.id}.jpg`,
    mimeType: meta.mimeType || "application/octet-stream",
    size: meta.size,
  };
}
