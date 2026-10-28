"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Fotografo = {
  display_name: string;
  slug: string;
  bio: string | null;
  instagram: string | null;
  whatsapp: string | null;
  avatar_url: string | null;
};

export function ProfileForm({ fotografo }: { fotografo: Fotografo }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState(fotografo.display_name);
  const [slug, setSlug] = useState(fotografo.slug);
  const [bio, setBio] = useState(fotografo.bio ?? "");
  const [instagram, setInstagram] = useState(fotografo.instagram ?? "");
  const [whatsapp, setWhatsapp] = useState(fotografo.whatsapp ?? "");
  const [avatarUrl, setAvatarUrl] = useState(fotografo.avatar_url ?? "");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    setEnviandoFoto(true);

    try {
      const presignRes = await fetch("/api/upload/avatar-presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      if (!presignRes.ok) throw new Error((await presignRes.json()).error);
      const { uploadUrl, publicUrl } = await presignRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("falha ao enviar a foto");

      setAvatarUrl(publicUrl);
    } catch (err: any) {
      setErro(err.message || "falha ao enviar a foto");
    } finally {
      setEnviandoFoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(false);

    const res = await fetch("/api/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: nome, slug, bio, instagram, whatsapp, avatarUrl }),
    });

    if (!res.ok) {
      setErro((await res.json()).error);
      setSalvando(false);
      return;
    }

    setSucesso(true);
    setSalvando(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="mb-2 flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-neutral-100">
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
            id="avatar-input"
          />
          <label
            htmlFor="avatar-input"
            className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100"
          >
            {enviandoFoto ? "Enviando…" : "Trocar foto de perfil"}
          </label>
        </div>
      </div>

      <label className="text-sm">
        Nome
        <input
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
        />
      </label>
      <label className="text-sm">
        Endereço do portfólio
        <div className="mt-1 flex items-center rounded-lg border border-neutral-300 text-sm">
          <span className="pl-3 text-neutral-400">/p/</span>
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            className="w-full px-1 py-2.5"
          />
        </div>
      </label>
      <label className="text-sm">
        Bio
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
        />
      </label>
      <label className="text-sm">
        Instagram
        <input
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="@seu_usuario"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
        />
      </label>
      <label className="text-sm">
        WhatsApp
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="(xx) xxxxx-xxxx"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
        />
      </label>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-600">Salvo!</p>}

      <button
        disabled={salvando}
        className="mt-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
      >
        {salvando ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
