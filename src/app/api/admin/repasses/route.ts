import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "rangelmaker@gmail.com";

const bodySchema = z.object({
  photographerId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  note: z.string().optional(),
});

/** Registra um repasse (transferência Pix feita manualmente fora do app)
 * pro fotógrafo. Só o dono da plataforma pode chamar isso — ver painel
 * /painel/admin. O valor some do "saldo a receber" dele automaticamente,
 * já que esse saldo é calculado como vendas pagas menos repasses. */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "acesso restrito" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  const { photographerId, amountCents, note } = parsed.data;

  const service = createServiceClient();
  const { error } = await service.from("payouts").insert({
    photographer_id: photographerId,
    amount_cents: amountCents,
    note: note || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
