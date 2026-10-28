import Link from "next/link";
import { HeroSlider } from "./hero-slider";

const RECURSOS = [
  {
    titulo: "Entrega e aprovação",
    descricao: "Link único por galeria, cliente favorita as fotos sem precisar criar conta.",
  },
  {
    titulo: "Loja embutida",
    descricao: "Venda downloads em alta resolução e prints físicos direto na galeria.",
  },
  {
    titulo: "Portfólio público",
    descricao: "Mostre seu melhor trabalho numa página com a sua marca, não a nossa.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="flex flex-col items-start gap-6 text-left">
          <span className="text-sm uppercase tracking-widest text-neutral-500">
            Titan Galeria
          </span>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Entregue, encante e venda.
            <br />
            Tudo numa galeria só.
          </h1>
          <p className="max-w-xl text-lg text-neutral-600">
            Envie fotos e vídeos pros seus clientes aprovarem, venda prints e
            downloads em alta resolução, e mostre seu melhor trabalho num
            portfólio público — feito pra fotógrafos e videomakers brasileiros.
          </p>
          <div className="flex gap-4">
            <Link
              href="/entrar"
              className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:opacity-90"
            >
              Criar minha conta
            </Link>
            <Link
              href="/precos"
              className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-medium transition hover:bg-neutral-100"
            >
              Ver planos
            </Link>
          </div>
        </div>

        <HeroSlider />
      </div>

      <div className="mt-24 grid gap-8 sm:grid-cols-3">
        {RECURSOS.map((r) => (
          <div key={r.titulo}>
            <h2 className="font-semibold">{r.titulo}</h2>
            <p className="mt-2 text-sm text-neutral-600">{r.descricao}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
