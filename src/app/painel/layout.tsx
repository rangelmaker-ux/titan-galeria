import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SairButton } from "./sair-button";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: fotografo } = await supabase
    .from("photographers")
    .select("display_name, slug")
    .eq("id", user?.id)
    .single();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col justify-between border-r border-neutral-200 p-5">
        <div>
          <p className="mb-8 text-sm font-semibold">Titan Galeria</p>
          <nav className="flex flex-col gap-1 text-sm">
            <Link href="/painel" className="rounded-md px-3 py-2 hover:bg-neutral-100">
              Galerias
            </Link>
            <Link href="/painel/produtos" className="rounded-md px-3 py-2 hover:bg-neutral-100">
              Produtos
            </Link>
            <Link href="/painel/assinatura" className="rounded-md px-3 py-2 hover:bg-neutral-100">
              Assinatura
            </Link>
            <Link
              href="/painel/configuracoes"
              className="rounded-md px-3 py-2 hover:bg-neutral-100"
            >
              Meu perfil
            </Link>
            {fotografo?.slug && (
              <Link
                href={`/p/${fotografo.slug}`}
                target="_blank"
                className="rounded-md px-3 py-2 text-neutral-500 hover:bg-neutral-100"
              >
                Ver portfólio público ↗
              </Link>
            )}
          </nav>
        </div>
        <div className="text-xs text-neutral-500">
          <p className="mb-2 truncate">{fotografo?.display_name}</p>
          <SairButton />
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
