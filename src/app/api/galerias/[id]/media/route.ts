import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  key: z.string().min(1),
  previewKey: z.string().min(1),
  type: z.enum(["photo", "video"]),
  width: z.number().optional(),
  height: z.number().optional(),
  durationS: z.number().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  }
  const { key, previewKey, type, width, height, durationS } = parsed.data;

  // RLS garante que só o dono da galeria consegue inserir aqui.
  const { data, error } = await supabase
    .from("media")
    .insert({
      gallery_id: params.id,
      type,
      r2_key_original: key,
      r2_key_preview: previewKey,
      width,
      height,
      duration_s: durationS,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ id: data.id });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { mediaId } = await req.json();
  const { error } = await supabase
    .from("media")
    .delete()
    .eq("id", mediaId)
    .eq("gallery_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
