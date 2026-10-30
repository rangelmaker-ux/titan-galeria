"use client";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
const PHOTOS = ["casamento", "familia", "15-anos", "natal", "dia-das-criancas", "familia"];
export default function EntrarPage() {
  const router = useRouter(); const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [email, setEmail] = useState(""); const [senha, setSenha] = useState(""); const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(null); setNotice(null);
    try {
      const db = createClient();
      if (modo === "cadastrar") { const { data, error: authError } = await db.auth.signUp({ email, password: senha, options: { data: { display_name: nome.trim() } } }); if (authError) throw authError; if (!data.session) { setNotice("Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre aqui."); return; } }
      else { const { error: authError } = await db.auth.signInWithPassword({ email, password: senha }); if (authError) throw authError; }
      router.push("/painel"); router.refresh();
    } catch (e) { const msg = e instanceof Error ? e.message : "Falha de conexão. Tente novamente."; setError(msg.includes("Invalid login credentials") ? "E-mail ou senha incorretos." : msg.includes("already registered") ? "Este e-mail já tem uma conta." : msg.includes("Email not confirmed") ? "Confirme seu e-mail antes de entrar." : msg); }
    finally { setBusy(false); }
  }
  return <main className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-ink p-4 sm:p-6 lg:justify-between lg:px-16 xl:px-24">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 overflow-hidden"><div className="absolute -inset-12 grid rotate-[-8deg] grid-cols-3 gap-3 opacity-65 sm:gap-5">{[0,1,2].map((col) => <div key={col} className={`flex flex-col gap-3 sm:gap-5 ${col % 2 ? "-translate-y-16" : "translate-y-8"}`}>{[0,1,2].map((row) => <div key={row} className="relative h-[38vh] overflow-hidden rounded-2xl bg-neutral-800"><Image src={`/images/landing/${PHOTOS[(col + row) % PHOTOS.length]}.jpg`} fill sizes="(max-width: 768px) 45vw, 35vw" quality={60} alt="" className="object-cover"/><div className="absolute inset-0 login-photo-crossfade" style={{animationDelay:`${(col * 3 + row) * -2}s`}}><Image src={`/images/landing/${PHOTOS[(col + row + 2) % PHOTOS.length]}.jpg`} fill sizes="(max-width: 768px) 45vw, 35vw" quality={60} alt="" className="object-cover"/></div></div>)}</div>)}</div></div>
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/40 to-black/60"/>
    <section className="hidden max-w-md text-white lg:block"><Logo invert size={24} textClassName="text-sm tracking-[0.25em]" /><h1 className="mt-10 text-5xl font-semibold leading-tight">Seu olhar.<br/>Sua galeria.<br/>Seu próximo capítulo.</h1><p className="mt-6 max-w-xs text-base leading-relaxed text-white/70">Um espaço para entregar suas fotos, compartilhar histórias e vender seu trabalho.</p></section>
    <section aria-labelledby="acesso-titulo" className="w-full max-w-sm rounded-3xl border border-white/30 bg-paper p-6 shadow-2xl sm:p-8"><Logo size={18} textClassName="text-xs" /><h2 id="acesso-titulo" className="mt-6 text-2xl font-semibold">{modo === "entrar" ? "Bem-vindo de volta" : "Seu trabalho começa aqui"}</h2><p className="mb-6 mt-2 text-sm leading-relaxed text-neutral-500">{modo === "entrar" ? "Entre para cuidar das suas galerias." : "Crie sua conta e comece pelo plano gratuito."}</p>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="space-y-4">{modo === "cadastrar" && <label className="block text-sm">Seu nome<input autoComplete="name" required value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1.5 block w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5"/></label>}<label className="block text-sm">E-mail<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 block w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5"/></label><label className="block text-sm">Senha<input type="password" autoComplete={modo === "entrar" ? "current-password" : "new-password"} required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} className="mt-1.5 block w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5"/></label><button disabled={busy} className="w-full rounded-full bg-ink px-4 py-3 text-sm font-medium text-paper disabled:opacity-50">{busy ? "Aguarde…" : modo === "entrar" ? "Entrar na minha conta" : "Criar conta gratuita"}</button></fieldset>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{notice && <p role="status" className="text-sm text-green-800">{notice}</p>}</form>
      <button disabled={busy} onClick={() => {setModo(modo === "entrar" ? "cadastrar" : "entrar");setError(null);setNotice(null);}} className="mt-5 w-full text-center text-sm text-neutral-600 underline-offset-4 hover:underline">{modo === "entrar" ? "Ainda não tem conta? Criar agora" : "Já tenho conta · Entrar"}</button>
    </section>
  </main>;
}
