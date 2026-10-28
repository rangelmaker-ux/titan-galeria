import { createClient } from "@/lib/supabase/server";
import { PLAN_ORDER, PLANS, getPlan } from "@/lib/plans";
import { BotaoAssinar, BotaoGerenciarAssinatura } from "./assinatura-client";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  inactive: "Sem assinatura ativa",
  trialing: "Em teste",
  active: "Ativa",
  past_due: "Pagamento atrasado",
  canceled: "Cancelada",
  unpaid: "Não paga",
};

export default async function AssinaturaPage({
  searchParams,
}: {
  searchParams: { sucesso?: string; cancelado?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: fotografo } = await supabase
    .from("photographers")
    .select("plan, subscription_status, subscription_current_period_end")
    .eq("id", user?.id)
    .single();

  const planoAtual = getPlan(fotografo?.plan);
  const status = fotografo?.subscription_status || "inactive";
  const temAssinaturaAtiva = status === "active" || status === "trialing" || status === "past_due";

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Assinatura</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Gerencie o plano da sua conta na Titan Galeria.
      </p>

      {searchParams.sucesso && (
        <div className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          Assinatura confirmada! Pode levar alguns segundos pra atualizar aqui.
        </div>
      )}
      {searchParams.cancelado && (
        <div className="mb-6 rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
          Checkout cancelado — nenhuma cobrança foi feita.
        </div>
      )}

      <div className="mb-8 rounded-2xl border border-neutral-200 p-6">
        <p className="text-sm text-neutral-500">Plano atual</p>
        <p className="mt-1 text-2xl font-semibold">{planoAtual.nome}</p>
        <p className="mt-1 text-sm text-neutral-500">
          Status: <span className="font-medium">{STATUS_LABEL[status] || status}</span>
        </p>
        {fotografo?.subscription_current_period_end && (
          <p className="mt-1 text-sm text-neutral-500">
            Renova em{" "}
            {new Date(fotografo.subscription_current_period_end).toLocaleDateString("pt-BR")}
          </p>
        )}
        {temAssinaturaAtiva && (
          <div className="mt-4">
            <BotaoGerenciarAssinatura />
          </div>
        )}
      </div>

      <h2 className="mb-4 text-lg font-semibold">
        {temAssinaturaAtiva ? "Trocar de plano" : "Escolha um plano"}
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const plano = PLANS[id];
          const ehAtual = fotografo?.plan === id && temAssinaturaAtiva;
          return (
            <div key={id} className="flex flex-col rounded-xl border border-neutral-200 p-5">
              <p className="font-semibold">{plano.nome}</p>
              <p className="mt-1 text-xl font-semibold">
                {plano.precoLabel}
                <span className="text-sm font-normal text-neutral-500">/mês</span>
              </p>
              <div className="mt-4">
                {ehAtual ? (
                  <span className="text-sm text-neutral-500">Seu plano atual</span>
                ) : (
                  <BotaoAssinar
                    plano={id}
                    label={temAssinaturaAtiva ? `Mudar pra ${plano.nome}` : "Assinar"}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
