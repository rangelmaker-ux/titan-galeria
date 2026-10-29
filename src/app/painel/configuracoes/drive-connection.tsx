"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MENSAGEM_STATUS: Record<string, { tipo: "ok" | "erro"; texto: string }> = {
  conectado: { tipo: "ok", texto: "Google Drive conectado! Os próximos uploads vão direto pra sua própria conta." },
  cancelado: { tipo: "erro", texto: "Conexão cancelada — nada foi alterado." },
  erro: { tipo: "erro", texto: "Não foi possível conectar o Drive. Tente novamente." },
  sem_refresh_token: { tipo: "erro", texto: "O Google não devolveu a autorização completa. Acesse myaccount.google.com → Segurança → Apps conectados, remova o acesso da Titan Galeria e tente conectar de novo." },
};

export function DriveConnection({ driveEmail, status }: { driveEmail: string | null; status?: string }) {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);
  const aviso = status ? MENSAGEM_STATUS[status] : undefined;

  async function desconectar() {
    if (!confirm("Desconectar o Drive? Os próximos uploads voltam a usar a conta padrão da plataforma até você conectar de novo.")) return;
    setSaindo(true);
    await fetch("/api/drive/disconnect", { method: "POST" });
    router.refresh();
    setSaindo(false);
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      {aviso && (
        <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${aviso.tipo === "ok" ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
          {aviso.texto}
        </p>
      )}
      {driveEmail ? (
        <>
          <p className="text-sm">
            Fotos originais em alta resolução vão direto pro <strong>seu</strong> Google Drive, na pasta
            "Titan Galeria".
          </p>
          <p className="mt-2 text-sm text-neutral-500">Conectado como <strong>{driveEmail}</strong></p>
          <button onClick={desconectar} disabled={saindo} className="mt-3 text-sm text-red-700 underline disabled:opacity-50">
            Desconectar
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-neutral-600">
            Conecte seu próprio Google Drive pra guardar as fotos originais na sua conta — sem
            depender do espaço da plataforma. Criamos uma pasta "Titan Galeria" lá dentro e,
            conforme você for marcando tags (aniversário, casamento...), ela se organiza em
            subpastas automaticamente.
          </p>
          <a href="/api/drive/connect" className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 text-sm text-paper">
            Conectar meu Google Drive
          </a>
        </>
      )}
    </div>
  );
}
