"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plans";
export function GrantPlan({ photographerId, manualPlan }: { photographerId: string; manualPlan: string | null }) {
  const router = useRouter(); const [plan, setPlan] = useState<PlanId>((manualPlan as PlanId) || "titan"); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function grant(value: PlanId | null) {
    if (!confirm(value ? `Liberar o plano ${PLANS[value].nome} para esta conta até você remover a concessão? Isso não cancela uma cobrança Stripe existente.` : "Remover a concessão manual? A conta voltará ao plano registrado pelo Stripe ou ao gratuito.")) return;
    setBusy(true); setError(null);
    try { const res = await fetch("/api/admin/planos", {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({photographerId,plan:value})}); const data=await res.json(); if(!res.ok)throw new Error(data.error);router.refresh(); }
    catch(e){setError(e instanceof Error?e.message:"Falha de conexão.");}finally{setBusy(false);}
  }
  return <div><div className="flex flex-wrap items-center gap-2"><label className="text-xs text-neutral-500">Plano a liberar<select aria-label="Plano a liberar" value={plan} disabled={busy} onChange={(e)=>setPlan(e.target.value as PlanId)} className="ml-2 rounded-lg border px-3 py-2 text-sm text-ink">{PLAN_ORDER.map(id=><option key={id} value={id}>{PLANS[id].nome}</option>)}</select></label><button disabled={busy} onClick={()=>void grant(plan)} className="rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50">Liberar manualmente</button>{manualPlan&&<button disabled={busy} onClick={()=>void grant(null)} className="rounded-full border px-4 py-2 text-sm disabled:opacity-50">Remover concessão</button>}</div>{error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</div>;
}
