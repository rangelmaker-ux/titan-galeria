"use client";

import { useState } from "react";

export function PasswordGate({ token, galleryTitle }: { token: string; galleryTitle: string }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    const res = await fetch(`/api/g/${token}/desbloquear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha }),
    });
    if (!res.ok) {
      setErro((await res.json()).error || "senha incorreta");
      setCarregando(false);
      return;
    }
    window.location.reload();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-xl font-semibold">{galleryTitle}</h1>
      <p className="mb-6 text-sm text-neutral-500">Essa galeria é protegida por senha.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="password"
          placeholder="Senha da galeria"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
        />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button
          disabled={carregando}
          className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
        >
          {carregando ? "Verificando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
