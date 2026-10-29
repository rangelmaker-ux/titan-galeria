"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendBlob } from "@/lib/upload-client";

type Props = {
  logoUrl: string | null;
  posX: number;
  posY: number;
  scale: number;
  opacity: number;
};

/** Marca d'água com a logo do fotógrafo: ele sobe a imagem, arrasta ela em
 * cima de uma foto de exemplo pra achar a posição certa, e ajusta tamanho
 * e opacidade — tudo com prévia ao vivo. Isso é o que de fato é usado
 * depois pra marcar as prévias das fotos enviadas (ver uploader.tsx). */
export function WatermarkForm({ logoUrl: initialLogoUrl, posX: initialPosX, posY: initialPosY, scale: initialScale, opacity: initialOpacity }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");
  const [posX, setPosX] = useState(initialPosX);
  const [posY, setPosY] = useState(initialPosY);
  const [scale, setScale] = useState(initialScale);
  const [opacity, setOpacity] = useState(initialOpacity);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const sujo = posX !== initialPosX || posY !== initialPosY || scale !== initialScale || opacity !== initialOpacity || logoUrl !== (initialLogoUrl ?? "");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      const data = await sendBlob("/api/upload/marca-dagua", file, { method: "POST", contentType: file.type, onProgress: () => {} });
      if (typeof data.publicUrl !== "string") throw new Error("O servidor não confirmou o envio da logo.");
      setLogoUrl(data.publicUrl);
    } catch (err: any) {
      setErro(err.message || "Não foi possível enviar a logo.");
    } finally {
      setEnviando(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function moverPara(clientX: number, clientY: number) {
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(2, Math.min(98, ((clientY - rect.top) / rect.height) * 100));
    setPosX(Math.round(x));
    setPosY(Math.round(y));
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    setArrastando(true);
    moverPara(e.clientX, e.clientY);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!arrastando) return;
    moverPara(e.clientX, e.clientY);
  }
  function onPointerUp() {
    setArrastando(false);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setSucesso(false);
    try {
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watermarkLogoUrl: logoUrl, watermarkPosX: posX, watermarkPosY: posY, watermarkScale: scale, watermarkOpacity: opacity }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Não foi possível salvar a marca d'água.");
      setSucesso(true);
      router.refresh();
    } catch (err: any) {
      setErro(err.message || "Falha de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Marca d&apos;água</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Sua logo aparece nas prévias com marca d&apos;água ativada (configure isso por galeria). Arraste a
        logo na prévia abaixo pra escolher a posição.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} className="hidden" id="watermark-logo-input" />
        <button type="button" disabled={enviando} onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50">
          {enviando ? "Enviando…" : logoUrl ? "Trocar logo" : "Enviar logo"}
        </button>
        {logoUrl && <button type="button" disabled={enviando} onClick={() => setLogoUrl("")} className="text-sm text-neutral-500 underline">Remover logo</button>}
        <span className="text-xs text-neutral-500">PNG com fundo transparente funciona melhor · até 2 MB</span>
      </div>

      {logoUrl && (
        <>
          <div
            ref={boxRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="relative mt-4 aspect-[4/3] w-full max-w-md touch-none select-none overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100"
          >
            <img src="/images/landing/casamento.jpg" alt="" aria-hidden="true" className="h-full w-full object-cover" draggable={false} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="Logo da marca d'água (arraste pra posicionar)"
              draggable={false}
              onPointerDown={onPointerDown}
              className="absolute cursor-move"
              style={{ left: `${posX}%`, top: `${posY}%`, width: `${scale}%`, opacity: opacity / 100, transform: "translate(-50%, -50%)" }}
            />
          </div>
          <p className="mt-2 text-xs text-neutral-500">Clique e arraste a logo até a posição que quiser. O que você vê aqui é o que vai sair nas fotos.</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Tamanho<span className="ml-2 text-xs text-neutral-500">{scale}%</span>
              <input type="range" min={8} max={50} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="mt-1 block w-full accent-ink" />
            </label>
            <label className="text-sm">
              Opacidade<span className="ml-2 text-xs text-neutral-500">{opacity}%</span>
              <input type="range" min={15} max={100} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="mt-1 block w-full accent-ink" />
            </label>
          </div>
        </>
      )}

      {erro && <p role="alert" className="mt-3 text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="mt-3 text-sm text-green-600">Salvo!</p>}

      <button type="button" disabled={salvando || enviando || !sujo} onClick={() => void salvar()} className="mt-4 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50">
        {salvando ? "Salvando…" : "Salvar marca d'água"}
      </button>
    </section>
  );
}
