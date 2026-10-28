import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyPlanError } from "@/lib/plans";

const bodySchema = z.object({
  type: z.enum(["download_single", "download_all", "print"]),
  name: z.string().min(1),
  priceCents: z.number().int().positive(),
  printSize: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  const { type, name, priceCents, printSize } = parsed.data;

  const { error } = await supabase.from("products").insert({
    photographer_id: user.id,
    type,
    name,
    price_cents: priceCents,
    print_size: type === "print" ? printSize : null,
  });

  if (error)
    return NextResponse.json(
      { error: friendlyPlanError(error.message) || error.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { id, active } = await req.json();
  const { error } = await supabase
    .from("products")
    .update({ active })
    .eq("id", id)
    .eq("photographer_id", user.id);

  if (error)
    return NextResponse.json(
      { error: friendlyPlanError(error.message) || error.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true });
}
