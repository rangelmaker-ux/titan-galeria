import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { ensureGalleryFolder, shareDriveItem, copyDriveFileInto, deleteDriveFile } from "@/lib/drive";
import { getDriveAccount } from "@/lib/drive-account";

const bodySchema = z.object({ galleryId: z.string().uuid(), apagarOriginais: z.boolean().optional() });

/** Conserto pontual pra galerias que foram enviadas pro Drive do
 * administrador antes do fotógrafo conectar o próprio (bug corrigido em
 * drive-account.ts/drive/callback). Compartilha a pasta da galeria com o
 * e-mail do Drive do fotógrafo e copia cada arquivo original pra DENTRO do
 * Drive dele — a cópia nasce como arquivo próprio dele, não conta mais no
 * espaço do administrador. Só o admin (ver src/lib/admin.ts) pode chamar. */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user)) return NextResponse.json({ error: "não autorizado" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "informe galleryId" }, { status: 400 });
  const { galleryId, apagarOriginais } = parsed.data;

  const db = createServiceClient();
  const { data: galeria } = await db.from("galleries").select("id, title, photographer_id, drive_folder_id, drive_tags(drive_folder_id)").eq("id", galleryId).single();
  if (!galeria) return NextResponse.json({ error: "galeria não encontrada" }, { status: 404 });

  const { data: fotografo } = await db.from("photographers").select("drive_refresh_token, drive_root_folder_id, drive_email").eq("id", galeria.photographer_id).single();
  if (!fotografo?.drive_refresh_token || !fotografo.drive_email) {
    return NextResponse.json({ error: "esse fotógrafo ainda não conectou o próprio Drive" }, { status: 400 });
  }
  const contaFotografo = { refreshToken: fotografo.drive_refresh_token, rootFolderId: fotografo.drive_root_folder_id };

  const { data: midias } = await db.from("media").select("id, drive_file_id").eq("gallery_id", galleryId).not("drive_file_id", "is", null);
  if (!midias?.length) return NextResponse.json({ ok: true, movidos: 0, falhas: [], mensagem: "nenhum arquivo no Drive pra mover" });

  // conta do administrador — é quem é dono dos arquivos hoje, então é ela
  // que precisa compartilhar (GOOGLE_REFRESH_TOKEN via fallback, ver drive.ts).
  const contaAdmin = {};

  try {
    if (galeria.drive_folder_id) {
      await shareDriveItem(contaAdmin, galeria.drive_folder_id, fotografo.drive_email, "writer");
    }
  } catch (e: any) {
    return NextResponse.json({ error: "falha ao compartilhar a pasta: " + (e.message || "") }, { status: 502 });
  }

  const tagInfo = Array.isArray(galeria.drive_tags) ? galeria.drive_tags[0] : galeria.drive_tags;
  const tagFolderId = (tagInfo as { drive_folder_id: string } | undefined)?.drive_folder_id ?? null;
  let destFolderId: string;
  try {
    destFolderId = await ensureGalleryFolder(contaFotografo, galeria.id, galeria.title, tagFolderId);
  } catch (e: any) {
    return NextResponse.json({ error: "falha ao preparar a pasta de destino no Drive do fotógrafo: " + (e.message || "") }, { status: 502 });
  }

  const falhas: { mediaId: string; erro: string }[] = [];
  let movidos = 0;
  for (const midia of midias) {
    if (!midia.drive_file_id) continue;
    try {
      const novoId = await copyDriveFileInto(contaFotografo, midia.drive_file_id, destFolderId);
      const antigoId = midia.drive_file_id;
      await db.from("media").update({ drive_file_id: novoId }).eq("id", midia.id);
      movidos++;
      if (apagarOriginais) {
        try { await deleteDriveFile(contaAdmin, antigoId); } catch { /* best-effort — não trava a migração se a limpeza falhar */ }
      }
    } catch (e: any) {
      falhas.push({ mediaId: midia.id, erro: e.message || "falha desconhecida" });
    }
  }

  if (movidos > 0) {
    await db.from("galleries").update({ drive_folder_id: destFolderId }).eq("id", galleryId);
  }

  return NextResponse.json({ ok: true, movidos, falhas, totalArquivos: midias.length });
}
