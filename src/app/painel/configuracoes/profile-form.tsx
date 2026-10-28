"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { preparePhoto, sendBlob } from "@/lib/upload-client";

type Fotografo = {
  display_name: string;
  slug: string;
  bio: string | null;
  instagram: string | null;
  whatsapp: string | null;
  avatar_url: string | null;
  pix_key: string | null;
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
  const [pixKey, setPixKey] = useState(fotografo.pix_key ?? "");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [progressoFoto, setProgressoFoto] = useState(0);
  const [fotoSalva, setFotoSalva] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || enviandoFoto) return;
    setErro(null);
    setEnviandoFoto(true);
    setFotoSalva(false);
    setProgressoFoto(0);

    try {
      const photo = await preparePhoto(file, null, 512);
      setProgressoFoto(5);
      const data = await sendBlob("/api/upload/preview?kind=avatar", photo.blob, {
        method: "POST", contentType: "image/jpeg", onProgress: (fraction) => setProgressoFoto(Math.floor(5 + fraction * 90)),
      });
      if (typeof data.publicUrl !== "string") throw new Error("O servidor não confirmou a foto de perfil.");
      setAvatarUrl(data.publicUrl);
      setProgressoFoto(100);
      setFotoSalva(true);
      router.refresh();
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
      body: JSON.stringify({ displayName: nome, slug, bio, instagram, whatsapp, avatarUrl, pixKey }),
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
            disabled={enviandoFoto || salvando}
            id="avatar-input"
          />
          <button
            type="button"
            disabled={enviandoFoto || salvando}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50"
          >
            {enviandoFoto ? "Enviando…" : "Trocar foto de perfil"}
          </button>
          {(enviandoFoto || fotoSalva) && <div className="mt-3"><progress aria-label="Envio da foto de perfil" value={progressoFoto} max={100} className="block h-2 w-48 accent-ink" /><p role="status" className="mt-1 text-xs text-neutral-600">{fotoSalva ? "Foto de perfil salva · 100%" : `${progressoFoto}% · ${progressoFoto >= 95 ? "Salvando no perfil…" : "Enviando foto…"}`}</p></div>}
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

      <label className="text-sm">
        Chave Pix para receber diretamente dos clientes
        <input
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          placeholder="CPF, e-mail, telefone ou chave aleatória"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
        />
        <span className="mt-1 block text-xs text-neutral-500">
          Você também pode configurar Pix e WhatsApp em Meus ganhos. Seus clientes pagam diretamente para você.
        </span>
      </label>

      {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-600">Salvo!</p>}

      <button
        disabled={salvando || enviandoFoto}
        className="mt-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
      >
        {salvando ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
