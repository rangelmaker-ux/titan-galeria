"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { SairButton } from "./sair-button";

type Item = { href: string; label: string; target?: string };

/** No celular a barra lateral fixa (w-56) não cabe e quebra a tela —
 * aqui ela vira uma barrinha no topo com um botão de menu, que abre os
 * mesmos links em tela cheia. Em telas md+ isso nem aparece (o aside
 * normal do layout continua sendo usado). */
export function MobileNav({ items, displayName }: { items: Item[]; displayName?: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-neutral-200 md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/painel" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <LogoMark size={22} />
          <span className="text-sm font-semibold">Titan Galeria</span>
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-2 hover:bg-neutral-100"
        >
          {open ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-neutral-200 px-3 py-3 text-sm">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              target={item.target}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2.5 hover:bg-neutral-100"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-neutral-200 px-3 pt-3 text-xs text-neutral-500">
            {displayName && <span className="truncate">{displayName}</span>}
            <SairButton />
          </div>
        </nav>
      )}
    </div>
  );
}
