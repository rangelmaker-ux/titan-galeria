import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-8 px-6 text-center">
      <span className="text-sm uppercase tracking-widest text-neutral-500">
        Titan Galeria
      </span>
      <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
        Entregue, encante e venda.
        <br />
        Tudo numa galeria só.
      </h1>
      <p className="max-w-2xl text-lg text-neutral-600">
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
          href="/entrar"
          className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-medium transition hover:bg-neutral-100"
        >
          Já tenho conta
        </Link>
      </div>
    </main>
  );
}
