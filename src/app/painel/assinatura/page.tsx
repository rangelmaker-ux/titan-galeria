import { createClient } from "@/lib/supabase/server";
import { PLAN_ORDER, PLANS, getPlan } from "@/lib/plans";
import { BotaoAssinar, BotaoGerenciarAssinatura } from "./assinatura-client";

export const dynamic = "force-dynamic";
const STATUS_LABEL: Record<string, string> = {
  inactive: "Sem assinatura ativa", trialing: "Em teste", active: "Ativa",
  past_due: "Pagamento em atraso", canceled: "Cancelada", unpaid: "Pagamento pendente",
};

export default async function AssinaturaPage({ searchParams }: { searchParams: { sucesso?: string; cancelado?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: fotografo, error } = await supabase.from("photographers")
    .select("plan, subscription_status, subscription_current_period_end, stripe_customer_id, plan_source")
    .eq("id", user?.id).single();
  if (error || !fotografo) return <p role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-700">Não foi possível carregar sua assinatura. Atualize a página para tentar novamente.</p>;
  const planoAtual = getPlan(fotografo.plan);
  const status = fotografo.subscription_status || "inactive";
  const acessoAdmin = fotografo.plan_source === "admin";
  const acessoManual = fotografo.plan_source === "manual";
  const acessoLiberado = acessoAdmin || acessoManual;
  const temAssinatura = ["active", "trialing", "past_due", "unpaid"].includes(status);
  const precisaAtencao = status === "past_due" || status === "unpaid";

  return (
    <div className="max-w-5xl space-y-7">
      <header><p className="mb-2 text-xs font-medium uppercase tracking-widest text-neutral-500">Sua conta</p><h1 className="text-2xl font-semibold">Plano e assinatura</h1><p className="mt-2 text-sm text-neutral-600">Acompanhe sua assinatura e escolha o plano para o seu trabalho.</p></header>
      {searchParams.sucesso && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">Checkout concluído. Aguarde a confirmação do Stripe para atualizar seu plano.</p>}
      {searchParams.cancelado && <p role="status" className="rounded-xl bg-neutral-100 p-4 text-sm text-neutral-700">Checkout cancelado. Você pode escolher um plano novamente quando quiser.</p>}
      <section aria-labelledby="plano-atual" className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-5 bg-neutral-50 p-6 sm:p-8">
          <div><p id="plano-atual" className="text-sm text-neutral-500">Seu plano atual</p><h2 className="mt-2 text-3xl font-semibold">{planoAtual.nome}</h2><p className="mt-2 text-xl font-semibold">{acessoAdmin ? "Acesso permanente" : acessoManual ? "Liberado pela administração" : planoAtual.precoLabel}<span className="text-sm font-normal text-neutral-500">{acessoLiberado ? " · ativo" : planoAtual.id === "gratuito" ? " · sem mensalidade" : "/mês"}</span></p></div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${acessoLiberado ? "bg-green-100 text-green-900" : precisaAtencao ? "bg-amber-100 text-amber-900" : temAssinatura || planoAtual.id === "gratuito" ? "bg-green-100 text-green-900" : "bg-neutral-200 text-neutral-700"}`}>{acessoAdmin ? "Administrador · sempre ativo" : acessoManual ? "Concessão manual ativa" : planoAtual.id === "gratuito" && !temAssinatura ? "Gratuito permanente" : STATUS_LABEL[status] || status}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-5 border-t border-neutral-200 p-6 sm:px-8">
          <div className="max-w-lg text-sm leading-relaxed text-neutral-600">
            {acessoAdmin ? <p>Seu plano Estúdio é permanente, sem cobrança para este acesso. <a href="/painel/admin" className="underline">Gerenciar contas e planos</a>.</p> : acessoManual ? <p>Seu acesso foi liberado manualmente e permanece ativo até revisão pela administração. Se já havia uma assinatura Stripe, confira essa cobrança separadamente no portal.</p> : planoAtual.id === "gratuito" && !temAssinatura ? <p>Seu plano gratuito não expira. Envie até 5 fotos ou 1 vídeo de até 15 MB por mês.</p> : <p>{precisaAtencao ? "Confira a cobrança pendente no portal para regularizar sua assinatura." : "Consulte cobranças, atualize o pagamento ou gerencie seu plano no portal seguro do Stripe."}</p>}
            {!acessoLiberado && temAssinatura && fotografo.subscription_current_period_end && <p className="mt-2">{status === "trialing" ? "Fim do teste" : "Fim do período atual"}: <span className="font-medium text-ink">{new Date(fotografo.subscription_current_period_end).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span></p>}
          </div>
          {fotografo.stripe_customer_id && <BotaoGerenciarAssinatura label={acessoLiberado ? "Gerenciar cobrança Stripe existente" : "Gerenciar assinatura"} />}
        </div>
      </section>
      <section aria-labelledby="planos-titulo">
        <h2 id="planos-titulo" className="text-lg font-semibold">{temAssinatura || acessoLiberado ? "Compare os planos" : "Escolha seu próximo plano"}</h2>
        <p className="mt-1 text-sm text-neutral-500">{acessoLiberado ? "Seu acesso já está ativo. Os preços abaixo são apenas para comparação." : temAssinatura ? "As alterações são feitas no portal do Stripe, onde você confere os valores antes de confirmar." : "Os valores abaixo são mensais. Você também pode continuar no plano gratuito."}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.filter((id) => id !== "gratuito").map((id) => {
            const plano = PLANS[id];
            const ehAtual = planoAtual.id === id && (temAssinatura || acessoLiberado);
            return <article key={id} className={`flex flex-col rounded-2xl border bg-white p-6 ${ehAtual ? "border-ink ring-1 ring-ink" : "border-neutral-200"}`}>
              <p className="mb-3 min-h-5 text-xs font-medium text-neutral-500">{ehAtual ? "SEU PLANO ATUAL" : plano.destaque ? "PARA EXPANDIR SEU TRABALHO" : "TITAN GALERIA"}</p>
              <h3 className="text-lg font-semibold">{plano.nome}</h3><p className="mt-3 text-2xl font-semibold">{plano.precoLabel}<span className="text-sm font-normal text-neutral-500">/mês</span></p>
              <ul className="my-6 flex-1 space-y-3 text-sm text-neutral-600"><li>{plano.galeriasLimite ? `Até ${plano.galeriasLimite} galerias` : "Galerias ilimitadas"}</li><li>{plano.todosTiposProduto ? "Todos os tipos de produto ativos" : "Um tipo de produto ativo por vez"}</li><li>{plano.marcaPropria ? "Galerias com sua marca" : "Galerias com a marca Titan"}</li></ul>
              {ehAtual ? <p className="rounded-full bg-neutral-100 px-4 py-2.5 text-center text-sm font-medium">Você está neste plano</p> : acessoLiberado ? <p className="text-sm text-neutral-500">Alteração pela administração</p> : temAssinatura ? (fotografo.stripe_customer_id ? <BotaoGerenciarAssinatura label="Ver opções de troca" /> : <p className="text-sm text-amber-800">Não foi possível vincular o portal. Entre em contato com o suporte antes de alterar seu plano.</p>) : <BotaoAssinar plano={id} label={`Escolher ${plano.nome}`} />}
            </article>;
          })}
        </div>
      </section>
    </div>
  );
}
