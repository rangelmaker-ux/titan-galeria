import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function POST() {
  const db = createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const { data, error } = await db.rpc("start_titan_trial");
  if (error || !data) return NextResponse.json({ error: "Não foi possível iniciar o teste. Tente novamente." }, { status: 500 });
  return NextResponse.json({ expiresAt: data });
}
