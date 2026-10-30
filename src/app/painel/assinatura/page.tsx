import { AccessWatcher } from "@/components/access-watcher";
import { accountAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { BILLING_ORDER, BILLING_OPTIONS, getPlan, getBillingOption } from "@/lib/plans";
import { BotaoAssinar, BotaoGerenciarAssinatura } from "./assinatura-client";

export const dynamic = "force-dynamic";
const STATUS_LABEL: Record<string, string> = {
  inactive: "Sem assinatura ativa", trialing: "Em teste", active: "Ativa",
  past_due: "Pagamento em atraso", canceled: "Cancelada", unpaid: "Pagamento pendente",
};

export default async function AssinaturaPage({ searchParams }: { searchParams: { sucesso?: string; cancelado?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.rpc("claim_titan_purchase");
  const { data: fotografo, error } = await supabase.from("photographers")
    .select("plan, billing_interval, subscription_status, subscription_current_period_end, stripe_customer_id, plan_source, manual_plan, paid_until, trial_started_at, trial_ends_at")
    .eq("id", user?.id).single();
  if (error || !fotografo) return <p role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-700">Não foi possível carregar sua assinatura. Atualize a página para tentar novamente.</p>;
  const access = accountAccess(fotografo);
  const planoAtual = getPlan(fotografo.plan);
  const cicloAtual = getBillingOption(fotografo.billing_interval);
  const status = fotografo.subscription_status || "inactive";
  const acessoAdmin = fotografo.plan_source === "admin";
  const acessoManual = fotografo.manual_plan === "titan";
  const acessoLiberado = acessoAdmin || acessoManual;
  const temAssinatura = ["active", "trialing", "past_due", "unpaid"].includes(status);
  const precisaAtencao = status === "past_due" || status === "unpaid";

  return (
    <div className="max-w-5xl space-y-7"><AccessWatcher waitForPayment={!!searchParams.sucesso && access !== "active"}/>
      <header><p className="mb-2 text-xs font-medium uppercase tracking-widest text-neutral-500">Sua conta</p><h1 className="text-2xl font-semibold">Plano e assinatura</h1><p className="mt-2 text-sm text-neutral-600">Acompanhe sua assinatura da Titan Galeria.</p></header>
      {access === "expired" && <aside role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><h2 className="font-semibold">{status === "inactive" ? "Seu teste de três dias terminou" : "Sua assinatura precisa ser regularizada"}</h2><p className="mt-2 text-sm">As ferramentas estão bloqueadas. Assine abaixo para recuperar o acesso após a confirmação do pagamento. Seus dados foram preservados.</p></aside>}
      {access === "welcome" && <aside className="rounded-xl bg-neutral-100 p-5 text-sm">Você ainda pode <a href="/painel/teste" className="font-medium underline">testar todas as ferramentas por três dias, sem cartão</a>.</aside>}
      <p className="rounded-xl border bg-white p-4 text-sm">E-mail para liberar seu acesso: <strong>{user?.email}</strong>. Use esse mesmo e-mail na compra. Se já comprou com outro e-mail, entre ou crie sua conta com o e-mail da compra.</p>
      {searchParams.sucesso && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">Checkout concluído. Aguarde a confirmação do Stripe para atualizar seu plano.</p>}
      {searchParams.cancelado && <p role="status" className="rounded-xl bg-neutral-100 p-4 text-sm text-neutral-700">Checkout cancelado. Você pode assinar novamente quando quiser.</p>}
      <section aria-labelledby="plano-atual" className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-5 bg-neutral-50 p-6 sm:p-8">
          <div>
            <p id="plano-atual" className="text-sm text-neutral-500">Seu plano atual</p>
            <h2 className="mt-2 text-3xl font-semibold">{planoAtual.nome}</h2>
            <p className="mt-2 text-xl font-semibold">
              {acessoAdmin ? "Acesso permanente" : acessoManual ? "Liberado pela administração" : temAssinatura && cicloAtual ? cicloAtual.precoLabel : planoAtual.id === "gratuito" ? access === "expired" ? "Teste encerrado" : "Três dias, sem cartão" : ""}
              {!acessoLiberado && temAssinatura && cicloAtual && <span className="text-sm font-normal text-neutral-500"> {cicloAtual.cicloLabel}</span>}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${acessoLiberado ? "bg-green-100 text-green-900" : precisaAtencao ? "bg-amber-100 text-amber-900" : temAssinatura || planoAtual.id === "gratuito" ? "bg-green-100 text-green-900" : "bg-neutral-200 text-neutral-700"}`}>{acessoAdmin ? "Administrador · sempre ativo" : acessoManual ? "Concessão manual ativa" : planoAtual.id === "gratuito" && !temAssinatura ? access === "expired" ? "Acesso bloqueado" : access === "trial" ? "Teste em andamento" : "Teste disponível" : STATUS_LABEL[status] || status}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-5 border-t border-neutral-200 p-6 sm:px-8">
          <div className="max-w-lg text-sm leading-relaxed text-neutral-600">
            {acessoAdmin ? <p>Seu acesso é permanente, sem cobrança. <a href="/painel/admin" className="underline">Gerenciar contas e planos</a>.</p> : acessoManual ? <p>Seu acesso foi liberado manualmente e permanece ativo até revisão pela administração. Se já havia uma assinatura Stripe, confira essa cobrança separadamente no portal.</p> : planoAtual.id === "gratuito" && !temAssinatura ? <p>O teste oferece todas as ferramentas por 72 horas, sem cobrança automática. Depois do prazo, uma assinatura é necessária para continuar.</p> : <p>{precisaAtencao ? "Confira a cobrança pendente no portal para regularizar sua assinatura." : "Consulte cobranças, atualize o pagamento ou troque a cadência no portal seguro do Stripe."}</p>}
            {!acessoLiberado && temAssinatura && fotografo.subscription_current_period_end && <p className="mt-2">{status === "trialing" ? "Fim do teste" : "Fim do período atual"}: <span className="font-medium text-ink">{new Date(fotografo.subscription_current_period_end).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span></p>}
          </div>
          {fotografo.stripe_customer_id && <BotaoGerenciarAssinatura label={acessoLiberado ? "Gerenciar cobrança Stripe existente" : "Gerenciar assinatura"} />}
        </div>
      </section>
      <section aria-labelledby="planos-titulo">
        <h2 id="planos-titulo" className="text-lg font-semibold">{temAssinatura || acessoLiberado ? "Cadências disponíveis" : "Escolha a cadência de cobrança"}</h2>
        <p className="mt-1 text-sm text-neutral-500">{acessoLiberado ? "Seu acesso já está ativo. Os preços abaixo são apenas para comparação." : temAssinatura ? "A troca de cadência é feita no portal do Stripe, onde você confere os valores antes de confirmar." : "Mesmo plano, acesso completo — você só escolhe com que frequência prefere pagar."}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {BILLING_ORDER.map((interval) => {
            const op = BILLING_OPTIONS[interval];
            const ehAtual = temAssinatura && cicloAtual?.interval === interval;
            return <article key={interval} className={`flex flex-col rounded-2xl border bg-white p-6 ${ehAtual ? "border-ink ring-1 ring-ink" : "border-neutral-200"}`}>
              <p className="mb-3 min-h-5 text-xs font-medium text-neutral-500">{ehAtual ? "SUA CADÊNCIA ATUAL" : op.destaque ? "25% DE DESCONTO" : "TITAN GALERIA"}</p>
              <h3 className="text-lg font-semibold">{op.label}</h3>
              <p className="mt-3 text-2xl font-semibold">{op.precoLabel}<span className="text-sm font-normal text-neutral-500"> {op.cicloLabel}</span></p>
              {op.economiaLabel && <p className="mt-1 text-xs text-neutral-500">{op.economiaLabel}</p>}
              <div className="my-6 flex-1" />
              {ehAtual ? <p className="rounded-full bg-neutral-100 px-4 py-2.5 text-center text-sm font-medium">Você está nesta cadência</p> : acessoLiberado ? <p className="text-sm text-neutral-500">Alteração pela administração</p> : temAssinatura ? (fotografo.stripe_customer_id ? <BotaoGerenciarAssinatura label="Ver opções de troca" /> : <p className="text-sm text-amber-800">Não foi possível vincular o portal. Entre em contato com o suporte antes de alterar.</p>) : <BotaoAssinar intervalo={interval} label={`Assinar ${op.label.toLowerCase()}`} />}
            </article>;
          })}
        </div>
      </section>
    </div>
  );
}
