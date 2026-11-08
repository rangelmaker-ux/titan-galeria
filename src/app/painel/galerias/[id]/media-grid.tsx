"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Midia = {
  id: string;
  type: "photo" | "video";
  previewUrl: string;
  width: number | null;
  height: number | null;
};

export function MediaGrid({ galleryId, midias }: { galleryId: string; midias: Midia[] }) {
  const router = useRouter();
  // Minimizar esconde as fotos pra chegar nas configurações sem rolar tudo.
  // A escolha fica lembrada neste navegador, por galeria.
  const chave = `titan_fotos_minimizadas_${galleryId}`;
  const [minimizada, setMinimizada] = useState(false);
  useEffect(() => { try { setMinimizada(localStorage.getItem(chave) === "1"); } catch { /* sem storage */ } }, [chave]);
  function alternar() {
    setMinimizada((v) => { try { localStorage.setItem(chave, v ? "0" : "1"); } catch { /* sem storage */ } return !v; });
  }

  async function excluir(mediaId: string) {
    if (!confirm("Excluir esse arquivo da galeria?")) return;
    await fetch(`/api/galerias/${galleryId}/media`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId }),
    });
    router.refresh();
  }

  if (!midias.length) {
    return <p className="text-sm text-neutral-500">Nenhuma foto ou vídeo enviado ainda.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{midias.length} {midias.length === 1 ? "arquivo" : "arquivos"} na galeria</p>
        <button type="button" onClick={alternar} aria-expanded={!minimizada} className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm hover:bg-neutral-100">
          {minimizada ? "Mostrar fotos ▾" : "Minimizar fotos ▴"}
        </button>
      </div>
      {!minimizada && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {midias.map((m) => (
        <div key={m.id} className="group relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
          {m.type === "photo" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <video src={m.previewUrl} className="h-full w-full object-cover" muted />
          )}
          <button
            onClick={() => excluir(m.id)}
            className="absolute right-1 top-1 hidden rounded-full bg-black/70 px-2 py-0.5 text-xs text-white group-hover:block"
          >
            excluir
          </button>
        </div>
      ))}
      </div>}
    </div>
  );
}
