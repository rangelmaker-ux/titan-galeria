import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ensureTagFolder } from "@/lib/drive";
import { getDriveAccount } from "@/lib/drive-account";

/** Lista as tags que esse fotógrafo já usou (pro autocompletar ao criar uma
 * galeria nova — "aniversário", "casamento", etc). */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data } = await supabase.from("drive_tags").select("id, name").eq("photographer_id", user.id).order("name");
  return NextResponse.json({ tags: data ?? [] });
}

const bodySchema = z.object({ name: z.string().trim().min(1).max(60) });

/** Garante a tag (e a pasta correspondente no Drive do fotógrafo) e devolve
 * o id — idempotente: se o fotógrafo já usou essa tag antes, reaproveita a
 * mesma pasta em vez de criar outra. */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "informe o nome da tag" }, { status: 400 });
  const name = parsed.data.name;

  const { data: existing } = await supabase.from("drive_tags").select("id").eq("photographer_id", user.id).eq("name", name).maybeSingle();
  if (existing) return NextResponse.json({ id: existing.id, name });

  try {
    const account = await getDriveAccount(user.id);
    const folderId = await ensureTagFolder(account, name);

    const service = createServiceClient();
    const { data, error } = await service
      .from("drive_tags")
      .insert({ photographer_id: user.id, name, drive_folder_id: folderId })
      .select("id")
      .single();
    // corrida: duas abas criando a mesma tag ao mesmo tempo — reaproveita a que ganhou.
    if (error) {
      const { data: again } = await supabase.from("drive_tags").select("id").eq("photographer_id", user.id).eq("name", name).maybeSingle();
      if (again) return NextResponse.json({ id: again.id, name });
      return NextResponse.json({ error: "não foi possível salvar a tag" }, { status: 400 });
    }

    return NextResponse.json({ id: data.id, name });
  } catch {
    return NextResponse.json({ error: "não foi possível criar a pasta no Drive" }, { status: 502 });
  }
}
