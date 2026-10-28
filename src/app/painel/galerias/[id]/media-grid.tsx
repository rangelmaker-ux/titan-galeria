"use client";

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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
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
    </div>
  );
}
