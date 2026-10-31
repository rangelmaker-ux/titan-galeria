"use client";

import { useState } from "react";
import { buildShareUrl } from "@/lib/share-link";

export function ShareLink({ shareToken, clientName }: { shareToken: string; clientName?: string | null }) {
  const [copiado, setCopiado] = useState(false);
  const url =
    typeof window !== "undefined"
      ? buildShareUrl(window.location.origin, shareToken, clientName)
      : buildShareUrl("", shareToken, clientName);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(url);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
      className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-100"
    >
      {copiado ? "Link copiado!" : "Copiar link de entrega"}
    </button>
  );
}
