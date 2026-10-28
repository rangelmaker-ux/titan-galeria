"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ProductToggle({ id, active, galleryId, galleries }: { id: string; active: boolean; galleryId: string | null; galleries: { id: string; title: string }[] }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function change(method: "PATCH" | "DELETE", values: object = {}) {
    setBusy(true); setError(null);
    try { const res = await fetch("/api/produtos", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...values }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha de conexão."); } finally { setBusy(false); }
  }
  return <div className="w-full max-w-sm"><label className="block text-xs text-neutral-600">Galeria vinculada<select aria-label="Galeria vinculada ao produto" value={galleryId || ""} disabled={busy} onChange={(e) => void change("PATCH", { galleryId: e.target.value })} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"><option value="" disabled>Escolha a galeria para vender</option>{galleries.map((g) => <option value={g.id} key={g.id}>{g.title}</option>)}</select></label><div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => void change("PATCH", { active: !active })} className="rounded-full border px-4 py-2 text-xs disabled:opacity-50">{active ? "Desativar" : "Ativar"}</button><button disabled={busy} onClick={() => { if (confirm("Excluir este produto do catálogo? Pedidos já feitos serão preservados.")) void change("DELETE"); }} className="rounded-full border border-red-200 px-4 py-2 text-xs text-red-700 disabled:opacity-50">Excluir produto</button></div>{error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}</div>;
}
