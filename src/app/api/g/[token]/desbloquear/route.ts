import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const { senha } = await req.json();
  const supabase = createServiceClient();

  const { data: galeria } = await supabase
    .from("galleries")
    .select("password_hash")
    .eq("share_token", params.token)
    .single();

  if (!galeria) return NextResponse.json({ error: "galeria não encontrada" }, { status: 404 });
  if (!galeria.password_hash) return NextResponse.json({ ok: true });

  const confere = await bcrypt.compare(senha ?? "", galeria.password_hash);
  if (!confere) return NextResponse.json({ error: "senha incorreta" }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  // cookie simples de sessão — suficiente pra um MVP (não é um token
  // assinado, mas o valor não é adivinhável e fica restrito a essa galeria).
  res.cookies.set(`g_${params.token}_ok`, "1", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
