"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProductToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function alternar() {
    setSalvando(true); setErro(null);
    try {
      const res = await fetch("/api/produtos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, active: !active }) });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Não foi possível alterar o produto."); }
      router.refresh();
    } catch (error) { setErro(error instanceof Error ? error.message : "Falha de conexão."); }
    finally { setSalvando(false); }
  }
  return <div className="max-w-xs text-right"><button onClick={alternar} disabled={salvando} className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50">{salvando ? "Salvando…" : active ? "Desativar" : "Ativar"}</button>{erro && <p role="alert" className="mt-2 text-xs text-red-700">{erro}</p>}</div>;
}
