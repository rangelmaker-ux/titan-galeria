import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SairButton } from "./sair-button";
import { MobileNav } from "./mobile-nav";
import { isAdmin } from "@/lib/admin";
import { LogoMark } from "@/components/logo";

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

  const navItems = [
    ...(isAdmin(user) ? [{ href: "/painel/admin", label: "Administração · planos" }] : []),
    { href: "/painel", label: "Galerias" },
    { href: "/painel/produtos", label: "Produtos" },
    { href: "/painel/assinatura", label: "Assinatura" },
    { href: "/painel/ganhos", label: "Meus ganhos" },
    { href: "/painel/configuracoes", label: "Meu perfil" },
    ...(fotografo?.slug ? [{ href: `/p/${fotografo.slug}`, label: "Ver portfólio público ↗", target: "_blank" }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* No celular a barra lateral não cabe — vira essa barra no topo. */}
      <MobileNav items={navItems} displayName={fotografo?.display_name} />

      <aside className="hidden w-56 shrink-0 flex-col justify-between border-r border-neutral-200 p-5 md:flex">
        <div>
          <p className="mb-8 flex items-center gap-2 text-sm font-semibold"><LogoMark size={20} />Titan Galeria</p>
          <nav className="flex flex-col gap-1 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                target={item.target}
                className={`rounded-md px-3 py-2 hover:bg-neutral-100 ${item.href === "/painel/admin" ? "bg-neutral-100 font-medium" : item.target ? "text-neutral-500" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="text-xs text-neutral-500">
          <p className="mb-2 truncate">{fotografo?.display_name}</p>
          <SairButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}
