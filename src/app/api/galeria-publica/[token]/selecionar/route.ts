import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  mediaId: z.string().uuid(),
  clientIdentifier: z.string().min(1).max(200),
  favorited: z.boolean().optional(),
  approved: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createServiceClient();

  const { data: galeria } = await supabase
    .from("galleries")
    .select("id, allow_favorites")
    .eq("share_token", params.token)
    .is("deleted_at", null)
    .single();
  if (!galeria) return NextResponse.json({ error: "galeria não encontrada" }, { status: 404 });
  if (!galeria.allow_favorites) {
    return NextResponse.json({ error: "favoritos desativados nessa galeria" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  const { mediaId, clientIdentifier, favorited, approved } = parsed.data;

  // confere que a mídia pertence mesmo a essa galeria antes de gravar.
  const { data: midia } = await supabase
    .from("media")
    .select("id")
    .eq("id", mediaId)
    .eq("gallery_id", galeria.id)
    .single();
  if (!midia) return NextResponse.json({ error: "mídia não encontrada" }, { status: 404 });

  const update: Record<string, unknown> = { media_id: mediaId, client_identifier: clientIdentifier };
  if (favorited !== undefined) update.favorited = favorited;
  if (approved !== undefined) update.approved = approved;

  const { error } = await supabase
    .from("media_selections")
    .upsert(update, { onConflict: "media_id,client_identifier" });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
