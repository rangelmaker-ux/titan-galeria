"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RegistrarRepasseForm({ photographerId }: { photographerId: string }) {
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [nota, setNota] = useState("");
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const cents = Math.round(parseFloat(valor.replace(",", ".")) * 100);
    if (!cents || cents <= 0) {
      setErro("valor inválido");
      return;
    }
    setEnviando(true);
    const res = await fetch("/api/admin/repasses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photographerId, amountCents: cents, note: nota || undefined }),
    });
    if (!res.ok) {
      setErro((await res.json()).error || "falha ao registrar");
      setEnviando(false);
      return;
    }
    setValor("");
    setNota("");
    setAberto(false);
    setEnviando(false);
    router.refresh();
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-100"
      >
        Marcar repasse Pix
      </button>
    );
  }

  return (
    <form onSubmit={registrar} className="flex items-center gap-2">
      <input
        required
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Ex: 150,00"
        className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
      />
      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Nota (opcional)"
        className="w-32 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
      />
      <button
        disabled={enviando}
        className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-50"
      >
        {enviando ? "..." : "Confirmar"}
      </button>
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="text-xs text-neutral-500 underline-offset-2 hover:underline"
      >
        cancelar
      </button>
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </form>
  );
}
