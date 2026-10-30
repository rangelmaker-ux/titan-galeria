import Link from "next/link";
import { BILLING_ORDER, BILLING_OPTIONS, PLANS } from "@/lib/plans";
import { Logo } from "@/components/logo";

const plano = PLANS.titan;

const RECURSOS = [
  "Galerias ilimitadas",
  "Todos os tipos de produto (download avulso, download de tudo, print)",
  "Galerias com a sua marca, sem a marca Titan Galeria",
  "Seu próprio Google Drive conectado — sem limite de armazenamento nosso",
  "Portfólio público com curtidas",
  "Suporte padrão",
];

export default function PrecosPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-12 text-center">
        <Logo className="justify-center" />
        <h1 className="mt-2 text-4xl font-semibold">Um plano só, acesso completo</h1>
        <p className="mt-3 text-neutral-600">
          Sem comissão por venda e sem níveis de recurso — você escolhe apenas a cadência de
          cobrança. O que você cobra dos seus clientes é todo seu.
        </p>
      </div>

      <div className="mb-10 rounded-2xl border border-neutral-200 bg-neutral-50 p-6 sm:p-8">
        <h2 className="text-lg font-semibold">{plano.nome}</h2>
        <ul className="mt-4 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
          {RECURSOS.map((r) => (
            <li key={r} className="flex gap-2">
              <span className="text-ink">✓</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {BILLING_ORDER.map((interval) => {
          const op = BILLING_OPTIONS[interval];
          return (
            <div
              key={interval}
              className={`flex flex-col rounded-2xl border p-6 ${
                op.destaque ? "border-ink shadow-lg" : "border-neutral-200"
              }`}
            >
              {op.destaque && (
                <span className="mb-3 w-fit rounded-full bg-ink px-3 py-1 text-xs font-medium text-paper">
                  25% de desconto
                </span>
              )}
              <h3 className="text-xl font-semibold">{op.label}</h3>
              <p className="mt-2">
                <span className="text-3xl font-semibold">{op.precoLabel}</span>
                <span className="text-neutral-500"> {op.cicloLabel}</span>
              </p>
              {op.economiaLabel && <p className="mt-1 text-sm text-neutral-500">{op.economiaLabel}</p>}
              <Link
                href="/entrar"
                className={`mt-6 rounded-full px-6 py-3 text-center text-sm font-medium transition ${
                  op.destaque ? "bg-ink text-paper hover:opacity-90" : "border border-neutral-300 hover:bg-neutral-100"
                }`}
              >
                Assinar {op.label.toLowerCase()}
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
