/** Definição do plano de assinatura da Titan Galeria (o fotógrafo paga a
 * plataforma pra usar a ferramenta — separado do checkout que o cliente
 * final paga pelas fotos). Desde que cada fotógrafo usa o próprio Google
 * Drive (ver drive-account.ts), não existe mais limite por nível de
 * recurso: um único plano pago ("titan") dá acesso completo, variando só
 * o ciclo de cobrança. Ver README.md > "Configurando o Stripe
 * (assinaturas)". */

export type PlanId = "gratuito" | "titan";
export type BillingInterval = "mensal" | "trimestral" | "anual";

export interface BillingOption {
  interval: BillingInterval;
  label: string;
  precoCentavos: number;
  precoLabel: string;
  cicloLabel: string;
  stripePriceId: string | undefined;
  destaque?: boolean;
  economiaLabel?: string;
}

export const BILLING_OPTIONS: Record<BillingInterval, BillingOption> = {
  mensal: {
    interval: "mensal",
    label: "Mensal",
    precoCentavos: 3700,
    precoLabel: "R$ 37,00",
    cicloLabel: "por mês",
    stripePriceId: process.env.STRIPE_PRICE_MENSAL,
  },
  trimestral: {
    interval: "trimestral",
    label: "Trimestral",
    precoCentavos: 9700,
    precoLabel: "R$ 97,00",
    cicloLabel: "a cada 3 meses",
    stripePriceId: process.env.STRIPE_PRICE_TRIMESTRAL,
    economiaLabel: "equivale a R$ 32,33/mês",
  },
  anual: {
    interval: "anual",
    label: "Anual",
    precoCentavos: 19700,
    precoLabel: "R$ 197,00",
    cicloLabel: "por ano",
    stripePriceId: process.env.STRIPE_PRICE_ANUAL,
    destaque: true,
    economiaLabel: "equivale a R$ 16,42/mês",
  },
};

export const BILLING_ORDER: BillingInterval[] = ["mensal", "trimestral", "anual"];

export interface PlanDef {
  id: PlanId;
  nome: string;
  galeriasLimite: number | null; // null = ilimitado
  todosTiposProduto: boolean;
  marcaPropria: boolean; // remove a marca "Titan Galeria" da galeria
  armazenamentoLabel: string;
  usuariosLabel: string;
  suporteLabel: string;
  uploadsGratisLabel?: string;
}

export const PLANS: Record<PlanId, PlanDef> = {
  gratuito: {
    id: "gratuito",
    nome: "Teste gratuito de três dias",
    galeriasLimite: null,
    todosTiposProduto: true,
    marcaPropria: true,
    armazenamentoLabel: "Seu próprio Google Drive — acesso completo durante o teste",
    usuariosLabel: "1 (só o dono)",
    suporteLabel: "Comunidade",
    uploadsGratisLabel: "Todas as ferramentas por 72 horas",
  },
  titan: {
    id: "titan",
    nome: "Titan Galeria",
    galeriasLimite: null,
    todosTiposProduto: true,
    marcaPropria: true,
    armazenamentoLabel: "Seu próprio Google Drive — sem limite nosso",
    usuariosLabel: "1 (só o dono)",
    suporteLabel: "Padrão",
  },
};

export const PLAN_ORDER: PlanId[] = ["gratuito", "titan"];

export function getPlan(id: string | null | undefined): PlanDef {
  if (id && Object.prototype.hasOwnProperty.call(PLANS, id)) return PLANS[id as PlanId];
  return PLANS.gratuito;
}

export function isFreePlan(id: string | null | undefined): boolean {
  return getPlan(id).id === "gratuito";
}

export function getBillingOption(interval: string | null | undefined): BillingOption | null {
  if (interval && Object.prototype.hasOwnProperty.call(BILLING_OPTIONS, interval)) {
    return BILLING_OPTIONS[interval as BillingInterval];
  }
  return null;
}

/** Qualquer Price ID das 3 cadências do Stripe indica o mesmo plano pago
 * (titan) — usado pelo webhook pra atualizar photographers.billing_plan. */
export function planFromStripePriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const interval of BILLING_ORDER) {
    if (BILLING_OPTIONS[interval].stripePriceId === priceId) return "titan";
  }
  return null;
}

/** Qual cadência (mensal/trimestral/anual) corresponde a um Price ID —
 * usado pelo webhook pra atualizar photographers.billing_interval. */
export function billingIntervalFromStripePriceId(priceId: string | null | undefined): BillingInterval | null {
  if (!priceId) return null;
  for (const interval of BILLING_ORDER) {
    if (BILLING_OPTIONS[interval].stripePriceId === priceId) return interval;
  }
  return null;
}

/** Mensagens amigáveis pros erros levantados pelos triggers do banco
 * (supabase/migrations/0006_plano_gratuito_repasses.sql) — só se aplicam
 * a quem ainda está no plano gratuito (sem assinatura ativa). */
export const PLAN_LIMIT_MESSAGES: Record<string, string> = {
  limite_fotos_gratuito:
    "Você atingiu o limite de 5 fotos por mês do plano gratuito. Assine a Titan Galeria pra enviar mais.",
  limite_video_gratuito:
    "O plano gratuito permite 1 vídeo por mês. Assine a Titan Galeria pra enviar mais.",
  limite_tamanho_video_gratuito:
    "O plano gratuito permite vídeos de até 15MB. Assine a Titan Galeria pra enviar vídeos maiores.",
};

export function friendlyPlanError(message: string): string | null {
  for (const key of Object.keys(PLAN_LIMIT_MESSAGES)) {
    if (message.includes(key)) return PLAN_LIMIT_MESSAGES[key];
  }
  return null;
}
