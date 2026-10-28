import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatarPreco(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default async function GanhosPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: fotografo } = await supabase
    .from("photographers")
    .select("pix_key")
    .eq("id", user?.id)
    .single();

  // RLS (orders_owner_read / payouts_owner_read) já restringe aos pedidos e
  // repasses do próprio fotógrafo logado.
  const { data: pedidos } = await supabase
    .from("orders")
    .select("id, total_cents, status, paid_at, client_identifier, gallery_id, galleries(title)")
    .eq("status", "paid")
    .order("paid_at", { ascending: false });

  const { data: repasses } = await supabase
    .from("payouts")
    .select("id, amount_cents, note, created_at")
    .order("created_at", { ascending: false });

  const totalVendido = (pedidos ?? []).reduce((soma, p) => soma + p.total_cents, 0);
  const totalRepassado = (repasses ?? []).reduce((soma, r) => soma + r.amount_cents, 0);
  const saldoAReceber = totalVendido - totalRepassado;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Meus ganhos</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Tudo que você já vendeu nas suas galerias e quanto já foi repassado via Pix.
      </p>

      {!fotografo?.pix_key && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Você ainda não cadastrou sua chave Pix.{" "}
          <a href="/painel/configuracoes" className="underline">
            Cadastre em Meu perfil
          </a>{" "}
          pra receber os repasses.
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 p-5">
          <p className="text-sm text-neutral-500">Total vendido</p>
          <p className="mt-1 text-xl font-semibold">{formatarPreco(totalVendido)}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-5">
          <p className="text-sm text-neutral-500">Já repassado</p>
          <p className="mt-1 text-xl font-semibold">{formatarPreco(totalRepassado)}</p>
        </div>
        <div className="rounded-2xl border border-ink p-5">
          <p className="text-sm text-neutral-500">Saldo a receber</p>
          <p className="mt-1 text-xl font-semibold">{formatarPreco(saldoAReceber)}</p>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Vendas pagas
      </h2>
      <div className="mb-8 flex flex-col gap-2">
        {!pedidos?.length && (
          <p className="text-sm text-neutral-500">Nenhuma venda paga ainda.</p>
        )}
        {pedidos?.map((p: any) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-2 text-sm"
          >
            <span>
              {p.galleries?.title} — {p.client_identifier}
            </span>
            <span className="text-neutral-500">
              {p.paid_at && new Date(p.paid_at).toLocaleDateString("pt-BR")}
            </span>
            <span className="font-medium">{formatarPreco(p.total_cents)}</span>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Repasses recebidos
      </h2>
      <div className="flex flex-col gap-2">
        {!repasses?.length && (
          <p className="text-sm text-neutral-500">Nenhum repasse registrado ainda.</p>
        )}
        {repasses?.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-2 text-sm"
          >
            <span>{r.note || "Repasse via Pix"}</span>
            <span className="text-neutral-500">
              {new Date(r.created_at).toLocaleDateString("pt-BR")}
            </span>
            <span className="font-medium">{formatarPreco(r.amount_cents)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
