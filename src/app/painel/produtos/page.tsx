import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "./product-form";
import { ProductToggle } from "./product-toggle";

const TIPO_LABEL: Record<string, string> = {
  download_single: "Download de uma foto",
  download_all: "Download da galeria completa",
  print: "Foto impressa",
};

export default async function ProdutosPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: produtos, error } = await supabase.from("products")
    .select("id, type, name, price_cents, currency, print_size, active")
    .eq("photographer_id", user?.id).order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-7">
      <header>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-neutral-500">Sua loja</p>
        <h1 className="text-2xl font-semibold">Produtos e preços</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">Monte seu catálogo de downloads e fotos impressas. Os produtos ativos aparecem nas suas galerias para o cliente escolher e comprar.</p>
      </header>
      <aside className="rounded-xl bg-neutral-100 p-5 text-sm leading-relaxed text-neutral-700">
        <p className="font-semibold">Como funciona a venda</p>
        <p className="mt-1">Você define o produto e o preço → o cliente compra na galeria → o pagamento confirmado aparece em <a className="font-medium underline" href="/painel/ganhos">Meus ganhos</a>.</p>
        <p className="mt-2 text-neutral-600">O repasse ao fotógrafo é manual, via Pix. A chave cadastrada nas configurações serve para receber esse repasse. Os limites de tipos de produto seguem seu plano.</p>
      </aside>
      <ProductForm />
      <section aria-labelledby="catalogo-titulo">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="catalogo-titulo" className="text-lg font-semibold">Seu catálogo</h2>
          <p className="text-sm text-neutral-500">Desative um produto para ocultá-lo das galerias.</p>
        </div>
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar o catálogo. Atualize a página para tentar novamente.</p> : (
          <div className="flex flex-col gap-3">
            {produtos?.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-5">
                <div><p className="font-semibold">{p.name}</p><p className="mt-1 text-sm text-neutral-500">{TIPO_LABEL[p.type]}{p.print_size ? ` · ${p.print_size}` : ""}</p><p className="mt-2 text-lg font-semibold">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: p.currency.toUpperCase() }).format(p.price_cents / 100)}</p></div>
                <div className="flex items-center gap-3"><span className={`rounded-full px-2.5 py-1 text-xs ${p.active ? "bg-green-50 text-green-800" : "bg-neutral-100 text-neutral-600"}`}>{p.active ? "À venda" : "Oculto"}</span><ProductToggle id={p.id} active={p.active} /></div>
              </div>
            ))}
            {!produtos?.length && <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center"><p className="font-medium">Seu primeiro produto começa aqui</p><p className="mt-2 text-sm text-neutral-500">Use o formulário acima para definir a primeira oferta da sua loja.</p></div>}
          </div>
        )}
      </section>
    </div>
  );
}
