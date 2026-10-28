"use client";

import { useState } from "react";
import { PlanId } from "@/lib/plans";

export function BotaoAssinar({ plano, label }: { plano: PlanId; label: string }) {
  const [carregando, setCarregando] = useState(false);

  async function assinar() {
    setCarregando(true);
    try {
      const res = await fetch("/api/assinatura/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "não foi possível iniciar o checkout");
        setCarregando(false);
      }
    } catch {
      alert("erro ao conectar com o servidor");
      setCarregando(false);
    }
  }

  return (
    <button
      onClick={assinar}
      disabled={carregando}
      className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-50"
    >
      {carregando ? "Abrindo..." : label}
    </button>
  );
}

export function BotaoGerenciarAssinatura({ label = "Gerenciar assinatura" }: { label?: string }) {
  const [carregando, setCarregando] = useState(false);

  async function abrirPortal() {
    setCarregando(true);
    try {
      const res = await fetch("/api/assinatura/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "não foi possível abrir o portal");
        setCarregando(false);
      }
    } catch {
      alert("erro ao conectar com o servidor");
      setCarregando(false);
    }
  }

  return (
    <button
      onClick={abrirPortal}
      disabled={carregando}
      className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium transition hover:bg-neutral-100 disabled:opacity-50"
    >
      {carregando ? "Abrindo..." : label}
    </button>
  );
}
