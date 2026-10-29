"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  galleryId: string;
  watermarkText: string;
  watermarkEnabled: boolean;
  plano?: string;
};

const QUINZE_MB = 15 * 1024 * 1024;

/** Gera uma versão reduzida (máx. 1600px) com marca d'água em diagonal,
 * desenhada num <canvas> — evita precisar de um pipeline de imagem no
 * servidor (sharp/ffmpeg) pra um MVP. Vídeo não é re-processado: ver nota
 * no README sobre a limitação de marca d'água em vídeo nesta versão. */
async function gerarPreviewFoto(file: File, watermark: string | null): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = URL.createObjectURL(file);
  });

  const maxW = 1600;
  const scale = Math.min(1, maxW / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  if (watermark) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.round(canvas.width / 18)}px sans-serif`;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 8);
    ctx.textAlign = "center";
    for (let y = -canvas.height; y < canvas.height; y += canvas.width / 4) {
      ctx.fillText(watermark, 0, y);
    }
    ctx.restore();
  }

  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.85)
  );
}

async function presign(
  galleryId: string,
  fileName: string,
  contentType: string,
  variant: "original" | "preview"
) {
  const res = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ galleryId, fileName, contentType, variant }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "falha ao gerar upload");
  return res.json() as Promise<{ uploadUrl: string; key: string }>;
}

async function uploadParaR2(uploadUrl: string, blob: Blob, contentType: string) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!res.ok) throw new Error("falha no upload pro R2");
}

/** Pede ao servidor uma URL de upload resumível do Google Drive (o original
 * em alta resolução vai pra lá, não pro R2 — ver README > "Armazenamento"). */
async function presignDrive(galleryId: string, fileName: string, contentType: string) {
  const res = await fetch("/api/upload/drive-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ galleryId, fileName, contentType }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "falha ao gerar upload");
  return res.json() as Promise<{ uploadUrl: string }>;
}

/** Envia o arquivo original direto pro Google Drive e devolve o ID do
 * arquivo criado (vem na resposta final do upload resumível). */
async function uploadParaDrive(uploadUrl: string, file: File): Promise<string> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error("falha no upload pro Google Drive");
  const data = await res.json();
  return data.id as string;
}

export function Uploader({ galleryId, watermarkText, watermarkEnabled, plano }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [porcentagemTotal, setPorcentagemTotal] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  async function handleFiles(files: FileList | File[]) {
    if (files.length === 0) return;
    setEnviando(true);
    setErro(null);
    setPorcentagemTotal(0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgresso(`Enviando ${i + 1} de ${files.length}: ${file.name}`);
      setPorcentagemTotal(Math.round(((i) / files.length) * 100));
      
      try {
        const isVideo = file.type.startsWith("video/");

        if (plano === "gratuito" && isVideo && file.size > QUINZE_MB) {
          throw new Error("O plano gratuito permite vídeos de até 15MB. Faça upgrade pra enviar vídeos maiores.");
        }

        // 1) upload do arquivo original pro Google Drive (usado só pra
        // download pago em alta resolução — ver README > "Armazenamento").
        const driveSession = await presignDrive(galleryId, file.name, file.type);
        const driveFileId = await uploadParaDrive(driveSession.uploadUrl, file);

        // 2) upload da versão de preview pro bucket PÚBLICO.
        let previewKey: string;
        if (!isVideo) {
          const previewBlob = await gerarPreviewFoto(file, watermarkEnabled ? watermarkText : null);
          const preview = await presign(galleryId, `preview-${file.name}.jpg`, "image/jpeg", "preview");
          await uploadParaR2(preview.uploadUrl, previewBlob, "image/jpeg");
          previewKey = preview.key;
        } else {
          // vídeo: preview = uma cópia do próprio arquivo no bucket público
          // (sem marca d'água — ver README, limitação conhecida da v1).
          const preview = await presign(galleryId, file.name, file.type, "preview");
          await uploadParaR2(preview.uploadUrl, file, file.type);
          previewKey = preview.key;
        }

        const dims = isVideo ? {} : await lerDimensoes(file);

        const res = await fetch(`/api/galerias/${galleryId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driveFileId,
            previewKey,
            type: isVideo ? "video" : "photo",
            sizeBytes: file.size,
            ...dims,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } catch (e: any) {
        setErro(`Erro em "${file.name}": ${e.message}`);
      }
    }

    setPorcentagemTotal(100);
    setTimeout(() => {
      setEnviando(false);
      setProgresso("");
      setPorcentagemTotal(0);
      router.refresh();
    }, 1000);
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      
      <div 
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !enviando && inputRef.current?.click()}
        className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-neutral-300 bg-neutral-50 hover:bg-neutral-100"
        } ${enviando ? "pointer-events-none opacity-80" : ""}`}
      >
        {enviando ? (
          <div className="w-full max-w-sm text-center">
            <p className="mb-2 text-sm font-medium text-neutral-700">{progresso}</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
              <div 
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${porcentagemTotal}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-neutral-500">{porcentagemTotal}% concluído</p>
          </div>
        ) : (
          <div className="text-center">
            <svg className="mx-auto mb-3 h-10 w-10 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-neutral-700">Clique ou arraste fotos e vídeos aqui</p>
            <p className="mt-1 text-xs text-neutral-500">Suporta JPG, PNG, MP4</p>
          </div>
        )}
      </div>

      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </div>
  );
}

function lerDimensoes(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = URL.createObjectURL(file);
  });
}
