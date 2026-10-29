import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { deletePreview } from "@/lib/r2";
import { deleteDriveFile } from "@/lib/drive";
import { getDriveAccount } from "@/lib/drive-account";
import { friendlyPlanError } from "@/lib/plans";

const bodySchema = z.object({
  driveFileId: z.string().min(1),
  previewKey: z.string().min(1),
  type: z.enum(["photo", "video"]),
  width: z.number().optional(),
  height: z.number().optional(),
  durationS: z.number().optional(),
  sizeBytes: z.number().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  }
  const { driveFileId, previewKey, type, width, height, durationS, sizeBytes } = parsed.data;

  // Uma resposta perdida no navegador não deve duplicar a foto ao tentar novamente.
  const { data: existing, error: lookupError } = await supabase.from("media")
    .select("id").eq("gallery_id", params.id).eq("drive_file_id", driveFileId).limit(1).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "não foi possível conferir o registro anterior" }, { status: 500 });
  if (existing) return NextResponse.json({ id: existing.id });

  // RLS garante que só o dono da galeria consegue inserir aqui. O trigger
  // media_limit_gratuito (migration 0006) barra o insert se o fotógrafo
  // estiver no plano gratuito e já tiver batido o limite do mês.
  const { data, error } = await supabase
    .from("media")
    .insert({
      gallery_id: params.id,
      type,
      drive_file_id: driveFileId,
      r2_key_preview: previewKey,
      width,
      height,
      duration_s: durationS,
      size_bytes: sizeBytes,
    })
    .select("id")
    .single();

  if (error) {
    const amigavel = friendlyPlanError(error.message);
    return NextResponse.json({ error: amigavel || error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data.id });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { mediaId } = await req.json();

  const { data: midia } = await supabase
    .from("media")
    .select("r2_key_preview, drive_file_id")
    .eq("id", mediaId)
    .eq("gallery_id", params.id)
    .single();

  const { error } = await supabase
    .from("media")
    .delete()
    .eq("id", mediaId)
    .eq("gallery_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // limpeza best-effort dos arquivos — não bloqueia a resposta se falhar.
  if (midia?.r2_key_preview) deletePreview(midia.r2_key_preview).catch(() => {});
  if (midia?.drive_file_id) getDriveAccount(user.id).then((account) => deleteDriveFile(account, midia.drive_file_id!)).catch(() => {});

  return NextResponse.json({ ok: true });
}
