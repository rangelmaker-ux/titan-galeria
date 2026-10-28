import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { RegistrarRepasseForm } from "./registrar-repasse-form";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "rangelmaker@gmail.com";

function formatarPreco(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect("/painel");
  }

  const service = createServiceClient();

  const { data: fotografos } = await service
    .from("photographers")
    .select("id, display_name, slug, plan, pix_key");

  const { data: pedidosPagos } = await service
    .from("orders")
    .select("total_cents, galleries(photographer_id)")
    .eq("status", "paid");

  const { data: repasses } = await service
    .from("payouts")
    .select("photographer_id, amount_cents");

  const vendidoPorFotografo = new Map<string, number>();
  for (const p of pedidosPagos ?? ([] as any[])) {
    const pid = (p as any).galleries?.photographer_id;
    if (!pid) continue;
    vendidoPorFotografo.set(pid, (vendidoPorFotografo.get(pid) ?? 0) + p.total_cents);
  }

  const repassadoPorFotografo = new Map<string, number>();
  for (const r of repasses ?? []) {
    repassadoPorFotografo.set(
      r.photographer_id,
      (repassadoPorFotografo.get(r.photographer_id) ?? 0) + r.amount_cents
    );
  }

  const linhas = (fotografos ?? [])
    .map((f) => {
      const vendido = vendidoPorFotografo.get(f.id) ?? 0;
      const repassado = repassadoPorFotografo.get(f.id) ?? 0;
      return { ...f, vendido, repassado, saldo: vendido - repassado };
    })
    .sort((a, b) => b.saldo - a.saldo);

  const saldoTotal = linhas.reduce((soma, l) => soma + l.saldo, 0);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Admin — repasses</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Saldo a receber de cada fotógrafo (vendas pagas menos repasses já marcados). Transfira
        via Pix pela sua conta e marque aqui depois.
      </p>

      <div className="mb-6 rounded-2xl border border-ink p-5">
        <p className="text-sm text-neutral-500">Total a repassar (todos os fotógrafos)</p>
        <p className="mt-1 text-2xl font-semibold">{formatarPreco(saldoTotal)}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Fotógrafo</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Chave Pix</th>
              <th className="px-4 py-3">Vendido</th>
              <th className="px-4 py-3">Repassado</th>
              <th className="px-4 py-3">Saldo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((f) => (
              <tr key={f.id} className="border-t border-neutral-100">
                <td className="px-4 py-3">
                  {f.display_name}
                  <span className="block text-xs text-neutral-400">/p/{f.slug}</span>
                </td>
                <td className="px-4 py-3 capitalize">{f.plan}</td>
                <td className="px-4 py-3 text-xs">{f.pix_key || "—"}</td>
                <td className="px-4 py-3">{formatarPreco(f.vendido)}</td>
                <td className="px-4 py-3">{formatarPreco(f.repassado)}</td>
                <td className="px-4 py-3 font-medium">{formatarPreco(f.saldo)}</td>
                <td className="px-4 py-3">
                  {f.saldo > 0 && <RegistrarRepasseForm photographerId={f.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
