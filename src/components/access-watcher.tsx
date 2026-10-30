"use client";
import { useEffect } from "react";
export function AccessWatcher({ expiresAt, waitForPayment=false }: { expiresAt?: string | null; waitForPayment?: boolean }) {
 useEffect(()=>{if(!expiresAt)return;const remaining=Date.parse(expiresAt)-Date.now();const timer=setTimeout(()=>window.location.assign("/painel/assinatura"),Math.max(0,remaining));return()=>clearTimeout(timer)},[expiresAt]);
 useEffect(()=>{if(!waitForPayment)return;let stopped=false;let timer:ReturnType<typeof setTimeout>;const controller=new AbortController();async function check(){try{if(document.visibilityState==="visible"){const res=await fetch("/api/acesso",{cache:"no-store",signal:controller.signal});if(res.ok){const data=await res.json();if(!stopped&&data.state==="active"){window.location.assign("/painel");return}}}}catch{}if(!stopped)timer=setTimeout(check,5000)}void check();return()=>{stopped=true;controller.abort();clearTimeout(timer)}},[waitForPayment]);
 return null;
}
