"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function OrderActions({ id }: { id: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function act(action: "confirm" | "cancel") {
    if (!confirm(action === "confirm" ? "Você conferiu na sua conta bancária o Pix e o valor deste pedido? Confirmar libera apenas os arquivos comprados." : "Cancelar este pedido pendente sem liberar downloads?")) return;
    setBusy(true); setError(null);
    try { const res = await fetch(`/api/pedidos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha de conexão."); }
    finally { setBusy(false); }
  }
  return <div><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void act("confirm")} className="rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50">Conferi o Pix · liberar pedido</button><button disabled={busy} onClick={() => void act("cancel")} className="rounded-full border px-4 py-2 text-sm disabled:opacity-50">Cancelar pedido</button></div>{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</div>;
}
