import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "./product-form";
import { ProductToggle } from "./product-toggle";

const TIPO_LABEL: Record<string, string> = {
  download_single: "Download de 1 foto",
  download_all: "Download de todas as fotos",
  print: "Print físico",
};

export default async function ProdutosPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: produtos } = await supabase
    .from("products")
    .select("id, type, name, price_cents, currency, print_size, active")
    .eq("photographer_id", user?.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Produtos</h1>
        <p className="text-sm text-neutral-500">
          O que seus clientes podem comprar dentro das galerias.
        </p>
      </div>

      <ProductForm />

      <div className="flex flex-col gap-2">
        {produtos?.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-neutral-500">
                {TIPO_LABEL[p.type]}
                {p.print_size ? ` · ${p.print_size}` : ""} · R${" "}
                {(p.price_cents / 100).toFixed(2)}
              </p>
            </div>
            <ProductToggle id={p.id} active={p.active} />
          </div>
        ))}
        {!produtos?.length && (
          <p className="text-sm text-neutral-500">Nenhum produto cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
