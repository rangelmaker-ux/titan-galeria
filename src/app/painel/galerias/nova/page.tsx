"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyPlanError } from "@/lib/plans";

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function NovaGaleriaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [titulo, setTitulo] = useState("");
  const [cliente, setCliente] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErro("Sessão expirada, faça login de novo.");
      setCarregando(false);
      return;
    }

    const { data, error } = await supabase
      .from("galleries")
      .insert({
        photographer_id: user.id,
        title: titulo,
        slug: slugify(titulo) + "-" + Math.random().toString(36).slice(2, 6),
        client_name: cliente || null,
      })
      .select("id")
      .single();

    if (error) {
      setErro(friendlyPlanError(error.message) || error.message);
      setCarregando(false);
      return;
    }

    router.push(`/painel/galerias/${data.id}`);
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-xl font-semibold">Nova galeria</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-sm">
          Título
          <input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Casamento Ana & Pedro"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
          />
        </label>
        <label className="text-sm">
          Nome do cliente (opcional)
          <input
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
          />
        </label>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="mt-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
        >
          {carregando ? "Criando…" : "Criar galeria"}
        </button>
      </form>
    </div>
  );
}
