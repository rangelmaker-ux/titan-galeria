"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Menu de três pontinhos no card do álbum — pra ligar/desligar a marca
 * d'água sem precisar entrar na galeria e abrir as configurações. Fica por
 * cima do link que cobre o card inteiro (ver painel/page.tsx), então todo
 * clique aqui dentro precisa de stopPropagation pra não acionar a navegação. */
export function GalleryCardMenu({ galleryId, watermarkPreviews }: { galleryId: string; watermarkPreviews: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [marca, setMarca] = useState(watermarkPreviews);
  const [salvando, setSalvando] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  async function alternarMarcaDagua() {
    setSalvando(true);
    const proximo = !marca;
    try {
      const res = await fetch(`/api/galerias/${galleryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watermarkPreviews: proximo }),
      });
      if (!res.ok) throw new Error();
      setMarca(proximo);
      router.refresh();
    } catch {
      /* silencioso aqui — o fotógrafo pode conferir/tentar de novo na própria galeria */
    } finally {
      setSalvando(false);
      setAberto(false);
    }
  }

  return (
    <div ref={ref} className="relative z-10 ml-auto shrink-0 self-start">
      <button
        type="button"
        aria-label="Mais ações deste álbum"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAberto((v) => !v); }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
      >
        ⋮
      </button>
      {aberto && (
        <div
          role="menu"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="absolute right-0 top-9 w-56 rounded-xl border border-neutral-200 bg-white p-1 text-sm shadow-lg"
        >
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={marca}
            disabled={salvando}
            onClick={() => void alternarMarcaDagua()}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-neutral-50 disabled:opacity-50"
          >
            <span>Marca d&apos;água nas prévias</span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${marca ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-600"}`}>
              {salvando ? "..." : marca ? "Ligada" : "Desligada"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
