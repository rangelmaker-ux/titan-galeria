import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  displayName: z.string().min(1),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, "use só letras minúsculas, números e hífen"),
  bio: z.string().optional(),
  instagram: z.string().optional(),
  whatsapp: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { displayName, slug, bio, instagram, whatsapp } = parsed.data;

  const { error } = await supabase
    .from("photographers")
    .update({ display_name: displayName, slug, bio, instagram, whatsapp })
    .eq("id", user.id);

  if (error) {
    const msg = error.message.includes("duplicate") ? "esse endereço já está em uso" : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
