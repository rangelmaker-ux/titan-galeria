import Link from "next/link";
import { PLAN_ORDER, PLANS } from "@/lib/plans";

const LINHAS: { label: string; valor: (p: (typeof PLANS)["essencial"]) => string }[] = [
  {
    label: "Galerias ativas",
    valor: (p) => (p.galeriasLimite ? `Até ${p.galeriasLimite}` : "Ilimitadas"),
  },
  {
    label: "Loja (download/print)",
    valor: (p) => (p.todosTiposProduto ? "Todos os tipos" : "Só 1 tipo de produto"),
  },
  {
    label: 'Marca "Titan Galeria" na galeria',
    valor: (p) => (p.marcaPropria ? "Removida (marca própria)" : "Aparece"),
  },
  { label: "Armazenamento", valor: (p) => p.armazenamentoLabel },
  { label: "Usuários/equipe", valor: (p) => p.usuariosLabel },
  { label: "Suporte", valor: (p) => p.suporteLabel },
];

export default function PrecosPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12 text-center">
        <span className="text-sm uppercase tracking-widest text-neutral-500">
          Titan Galeria
        </span>
        <h1 className="mt-2 text-4xl font-semibold">Planos simples, sem comissão por venda</h1>
        <p className="mt-3 text-neutral-600">
          Você paga uma mensalidade fixa pra usar a ferramenta — o que você cobra dos seus
          clientes é todo seu.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const plano = PLANS[id];
          return (
            <div
              key={id}
              className={`flex flex-col rounded-2xl border p-6 ${
                plano.destaque ? "border-ink shadow-lg" : "border-neutral-200"
              }`}
            >
              {plano.destaque && (
                <span className="mb-3 w-fit rounded-full bg-ink px-3 py-1 text-xs font-medium text-paper">
                  Mais popular
                </span>
              )}
              <h2 className="text-xl font-semibold">{plano.nome}</h2>
              <p className="mt-2">
                <span className="text-3xl font-semibold">{plano.precoLabel}</span>
                <span className="text-neutral-500">/mês</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2 text-sm text-neutral-700">
                {LINHAS.map((linha) => (
                  <li key={linha.label} className="flex justify-between gap-4">
                    <span className="text-neutral-500">{linha.label}</span>
                    <span className="text-right font-medium">{linha.valor(plano)}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/entrar"
                className={`mt-6 rounded-full px-6 py-3 text-center text-sm font-medium transition ${
                  plano.destaque
                    ? "bg-ink text-paper hover:opacity-90"
                    : "border border-neutral-300 hover:bg-neutral-100"
                }`}
              >
                Assinar {plano.nome}
              </Link>
            </div>
          );
        })}
      </div>

      <p className="mt-10 text-center text-sm text-neutral-500">
        Já tem conta?{" "}
        <Link href="/entrar" className="underline">
          Entre e assine
        </Link>{" "}
        direto pelo painel.
      </p>
    </main>
  );
}
