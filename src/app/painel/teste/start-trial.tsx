"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function StartTrial() {
 const router = useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 async function start(){setBusy(true);setError("");try{const res=await fetch("/api/teste/iniciar",{method:"POST"});const data=await res.json();if(!res.ok)throw new Error(data.error);router.push("/painel");router.refresh();}catch(e){setError(e instanceof Error?e.message:"Falha de conexão.");setBusy(false)}}
 return <><button disabled={busy} onClick={()=>void start()} className="rounded-full bg-ink px-8 py-3 text-sm text-paper disabled:opacity-50">{busy?"Iniciando…":"Testar por três dias"}</button>{error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</>;
}
