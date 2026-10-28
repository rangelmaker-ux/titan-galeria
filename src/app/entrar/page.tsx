"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function EntrarPage() {
  const router = useRouter();
  const supabase = createClient();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    if (modo === "cadastrar") {
      const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { display_name: nome } },
      });
      if (error) {
        setErro(traduzErro(error.message));
        setCarregando(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        setErro(traduzErro(error.message));
        setCarregando(false);
        return;
      }
    }

    router.push("/painel");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://picsum.photos/seed/titan-galeria-login/1000/1400"
          alt=""
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-col justify-center px-6 py-16">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="mb-1 text-2xl font-semibold">
            {modo === "entrar" ? "Entrar" : "Criar conta"}
          </h1>
          <p className="mb-6 text-sm text-neutral-500">
            {modo === "entrar"
              ? "Acesse o painel da sua conta."
              : "Comece a entregar e vender suas fotos e vídeos."}
          </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {modo === "cadastrar" && (
          <input
            type="text"
            placeholder="Seu nome"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
          />
        )}
        <input
          type="email"
          placeholder="E-mail"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
        />
        <input
          type="password"
          placeholder="Senha"
          required
          minLength={6}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
        />

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="mt-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
        >
          {carregando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
        </button>
      </form>

          <button
            onClick={() => setModo(modo === "entrar" ? "cadastrar" : "entrar")}
            className="mt-4 text-sm text-neutral-500 underline-offset-2 hover:underline"
          >
            {modo === "entrar" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
          </button>
        </div>
      </div>
    </main>
  );
}

function traduzErro(msg: string) {
  if (msg.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (msg.includes("already registered")) return "Esse e-mail já tem conta.";
  return msg;
}
