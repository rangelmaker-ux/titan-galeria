"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProductForm() {
  const router = useRouter();
  const [tipo, setTipo] = useState<"download_single" | "download_all" | "print">("download_single");
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [tamanho, setTamanho] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    const res = await fetch("/api/produtos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: tipo,
        name: nome,
        priceCents: Math.round(parseFloat(preco.replace(",", ".")) * 100),
        printSize: tamanho || undefined,
      }),
    });

    if (!res.ok) {
      setErro((await res.json()).error);
      setSalvando(false);
      return;
    }

    setNome("");
    setPreco("");
    setTamanho("");
    setSalvando(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 p-4">
      <label className="text-sm">
        Tipo
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as any)}
          className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="download_single">Download de 1 foto</option>
          <option value="download_all">Download de todas</option>
          <option value="print">Print físico</option>
        </select>
      </label>
      <label className="text-sm">
        Nome
        <input
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Foto em alta resolução"
          className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>
      {tipo === "print" && (
        <label className="text-sm">
          Tamanho
          <input
            value={tamanho}
            onChange={(e) => setTamanho(e.target.value)}
            placeholder="15x21"
            className="mt-1 block w-24 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
      )}
      <label className="text-sm">
        Preço (R$)
        <input
          required
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
          placeholder="29,90"
          className="mt-1 block w-28 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>
      <button
        disabled={salvando}
        className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
      >
        {salvando ? "Salvando…" : "Adicionar produto"}
      </button>
      {erro && <p className="w-full text-sm text-red-600">{erro}</p>}
    </form>
  );
}
