"use client";

import { useState } from "react";

export function ShareLink({ shareToken }: { shareToken: string }) {
  const [copiado, setCopiado] = useState(false);
  const url =
    typeof window !== "undefined" ? `${window.location.origin}/g/${shareToken}` : `/g/${shareToken}`;

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
