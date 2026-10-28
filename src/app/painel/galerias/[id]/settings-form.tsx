"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Galeria = {
  id: string;
  is_published: boolean;
  allow_favorites: boolean;
  allow_downloads: boolean;
  watermark_previews: boolean;
  password_hash: string | null;
};

export function GallerySettingsForm({ galeria }: { galeria: Galeria }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [senha, setSenha] = useState("");

  async function atualizar(campo: Record<string, unknown>) {
    setSalvando(true);
    await fetch(`/api/galerias/${galeria.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campo),
    });
    setSalvando(false);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Configurações
      </h2>

      <Toggle
        label="Publicar no portfólio público"
        checked={galeria.is_published}
        onChange={(v) => atualizar({ isPublished: v })}
      />
      <Toggle
        label="Cliente pode favoritar/aprovar fotos"
        checked={galeria.allow_favorites}
        onChange={(v) => atualizar({ allowFavorites: v })}
      />
      <Toggle
        label="Permitir download gratuito (sem cobrar)"
        checked={galeria.allow_downloads}
        onChange={(v) => atualizar({ allowDownloads: v })}
      />
      <Toggle
        label="Marca d'água nas prévias"
        checked={galeria.watermark_previews}
        onChange={(v) => atualizar({ watermarkPreviews: v })}
      />

      <div className="mt-2 flex items-center gap-2">
        <input
          type="password"
          placeholder={galeria.password_hash ? "Senha já definida — digite pra trocar" : "Sem senha"}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          disabled={salvando}
          onClick={() => atualizar({ password: senha || null })}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100"
        >
          Salvar senha
        </button>
        {galeria.password_hash && (
          <button
            disabled={salvando}
            onClick={() => atualizar({ password: null })}
            className="text-sm text-neutral-500 underline-offset-2 hover:underline"
          >
            Remover senha
          </button>
        )}
      </div>
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between text-sm">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );
}
