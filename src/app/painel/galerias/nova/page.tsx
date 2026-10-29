"use client";

import { useEffect, useState } from "react";
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
  const [tag, setTag] = useState("");
  const [tagsExistentes, setTagsExistentes] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/drive/tags")
      .then((r) => r.json())
      .then((d) => setTagsExistentes((d.tags ?? []).map((t: { name: string }) => t.name)))
      .catch(() => {});
  }, []);

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

    // Se digitou uma tag (ex: "Aniversário"), garante a pasta no Drive dela
    // antes de criar a galeria — reaproveita se já existir essa tag.
    let driveTagId: string | null = null;
    const tagLimpa = tag.trim();
    if (tagLimpa) {
      const res = await fetch("/api/drive/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tagLimpa }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Não foi possível salvar a tag.");
        setCarregando(false);
        return;
      }
      driveTagId = data.id;
    }

    const { data, error } = await supabase
      .from("galleries")
      .insert({
        photographer_id: user.id,
        title: titulo,
        slug: slugify(titulo) + "-" + Math.random().toString(36).slice(2, 6),
        client_name: cliente || null,
        drive_tag_id: driveTagId,
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
        <label className="text-sm">
          Tag (opcional)
          <input
            list="tags-existentes"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Ex: Aniversário, Casamento…"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
          />
          <datalist id="tags-existentes">
            {tagsExistentes.map((t) => <option key={t} value={t} />)}
          </datalist>
          <span className="mt-1 block text-xs text-neutral-500">
            As fotos originais dessa galeria vão pra uma pasta com esse nome no seu Drive — use a
            mesma tag de novo e ela cai na mesma pasta.
          </span>
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
