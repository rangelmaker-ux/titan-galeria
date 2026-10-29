import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ensureGalleryFolder, createDriveUploadSession } from "@/lib/drive";
import { getDriveAccount } from "@/lib/drive-account";
import { signUploadSession } from "@/lib/upload-session";

const bodySchema = z.object({
  galleryId: z.string().uuid(),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive().safe(),
});

/** Devolve uma URL de upload resumível do Google Drive pro arquivo ORIGINAL
 * (alta resolução). O preview com marca d'água continua indo pro R2 via
 * /api/upload/presign — ver src/components/uploader.tsx. */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  }
  const { galleryId, fileName, contentType, sizeBytes } = parsed.data;

  const { data: gallery } = await supabase
    .from("galleries")
    .select("id, title, drive_folder_id, drive_tags(drive_folder_id)")
    .eq("id", galleryId)
    .eq("photographer_id", user.id)
    .single();
  if (!gallery) return NextResponse.json({ error: "galeria não encontrada" }, { status: 404 });

  try {
    const account = await getDriveAccount(user.id);
    let folderId = gallery.drive_folder_id as string | null;
    if (!folderId) {
      const tagInfo = Array.isArray(gallery.drive_tags) ? gallery.drive_tags[0] : gallery.drive_tags;
      const tagFolderId = (tagInfo as { drive_folder_id: string } | undefined)?.drive_folder_id ?? null;
      folderId = await ensureGalleryFolder(account, gallery.id, gallery.title, tagFolderId);
      await supabase.from("galleries").update({ drive_folder_id: folderId }).eq("id", gallery.id);
    }

    const uploadUrl = await createDriveUploadSession(account, folderId, fileName, contentType, sizeBytes);
    const token = signUploadSession({ uploadUrl, userId: user.id, galleryId, sizeBytes });
    return NextResponse.json({ uploadUrl, token });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "falha ao conectar com o Google Drive" }, { status: 502 });
  }
}
