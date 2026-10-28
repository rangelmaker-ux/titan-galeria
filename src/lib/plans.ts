/** Definição dos planos de assinatura da Titan Galeria (o fotógrafo paga a
 * plataforma pra usar a ferramenta — separado do checkout que o cliente
 * final paga pelas fotos). Ver README.md > "Configurando o Stripe
 * (assinaturas)". */

export type PlanId = "gratuito" | "essencial" | "profissional" | "estudio";

export interface PlanDef {
  id: PlanId;
  nome: string;
  precoCentavos: number; // em centavos de BRL, só pra exibição
  precoLabel: string;
  stripePriceId: string | undefined;
  galeriasLimite: number | null; // null = ilimitado
  todosTiposProduto: boolean;
  marcaPropria: boolean; // remove a marca "Titan Galeria" da galeria
  armazenamentoLabel: string;
  usuariosLabel: string;
  suporteLabel: string;
  uploadsGratisLabel?: string;
  destaque?: boolean;
}

export const PLANS: Record<PlanId, PlanDef> = {
  gratuito: {
    id: "gratuito",
    nome: "Gratuito",
    precoCentavos: 0,
    precoLabel: "R$ 0",
    stripePriceId: undefined,
    galeriasLimite: null,
    todosTiposProduto: false,
    marcaPropria: false,
    armazenamentoLabel: "5 fotos ou 1 vídeo (até 15MB) por mês",
    usuariosLabel: "1 (só o dono)",
    suporteLabel: "Comunidade",
    uploadsGratisLabel: "5 fotos/mês ou 1 vídeo de até 15MB/mês",
  },
  essencial: {
    id: "essencial",
    nome: "Essencial",
    precoCentavos: 2490,
    precoLabel: "R$ 24,90",
    stripePriceId: process.env.STRIPE_PRICE_ESSENCIAL,
    galeriasLimite: 5,
    todosTiposProduto: false,
    marcaPropria: false,
    armazenamentoLabel: "10 GB",
    usuariosLabel: "1 (só o dono)",
    suporteLabel: "Padrão",
  },
  profissional: {
    id: "profissional",
    nome: "Profissional",
    precoCentavos: 6990,
    precoLabel: "R$ 69,90",
    stripePriceId: process.env.STRIPE_PRICE_PROFISSIONAL,
    galeriasLimite: null,
    todosTiposProduto: true,
    marcaPropria: true,
    armazenamentoLabel: "100 GB",
    usuariosLabel: "1 (só o dono)",
    suporteLabel: "Padrão",
    destaque: true,
  },
  estudio: {
    id: "estudio",
    nome: "Estúdio",
    precoCentavos: 11900,
    precoLabel: "R$ 119,00",
    stripePriceId: process.env.STRIPE_PRICE_ESTUDIO,
    galeriasLimite: null,
    todosTiposProduto: true,
    marcaPropria: true,
    armazenamentoLabel: "Ilimitado",
    usuariosLabel: "Até 5 logins",
    suporteLabel: "Prioritário",
  },
};

export const PLAN_ORDER: PlanId[] = ["gratuito", "essencial", "profissional", "estudio"];

export function getPlan(id: string | null | undefined): PlanDef {
  if (id && Object.prototype.hasOwnProperty.call(PLANS, id)) return PLANS[id as PlanId];
  return PLANS.gratuito;
}

export function isFreePlan(id: string | null | undefined): boolean {
  return getPlan(id).id === "gratuito";
}

export function planFromStripePriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const id of PLAN_ORDER) {
    if (PLANS[id].stripePriceId === priceId) return id;
  }
  return null;
}

/** Mensagens amigáveis pros erros levantados pelos triggers do banco
 * (supabase/migrations/0003_subscriptions.sql). */
export const PLAN_LIMIT_MESSAGES: Record<string, string> = {
  limite_galerias_essencial:
    "Você atingiu o limite de 5 galerias do plano Essencial. Faça upgrade pra criar mais.",
  limite_tipo_produto_essencial:
    "O plano Essencial permite só um tipo de produto ativo por vez. Faça upgrade pra liberar todos.",
  limite_fotos_gratuito:
    "Você atingiu o limite de 5 fotos por mês do plano gratuito. Faça upgrade pra enviar mais.",
  limite_video_gratuito:
    "O plano gratuito permite 1 vídeo por mês. Faça upgrade pra enviar mais.",
  limite_tamanho_video_gratuito:
    "O plano gratuito permite vídeos de até 15MB. Faça upgrade pra enviar vídeos maiores.",
};

export function friendlyPlanError(message: string): string | null {
  for (const key of Object.keys(PLAN_LIMIT_MESSAGES)) {
    if (message.includes(key)) return PLAN_LIMIT_MESSAGES[key];
  }
  return null;
}
