"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  galleryId: string;
  watermarkText: string;
  watermarkEnabled: boolean;
};

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

export function Uploader({ galleryId, watermarkText, watermarkEnabled }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function handleFiles(files: FileList) {
    setEnviando(true);
    setErro(null);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgresso(`Enviando ${i + 1} de ${files.length}: ${file.name}`);
      try {
        const isVideo = file.type.startsWith("video/");

        // 1) upload do arquivo original pro bucket PRIVADO (usado só pra
        // download pago em alta resolução).
        const original = await presign(galleryId, file.name, file.type, "original");
        await uploadParaR2(original.uploadUrl, file, file.type);

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
            key: original.key,
            previewKey,
            type: isVideo ? "video" : "photo",
            ...dims,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } catch (e: any) {
        setErro(`Erro em "${file.name}": ${e.message}`);
      }
    }

    setEnviando(false);
    setProgresso("");
    router.refresh();
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <button
        disabled={enviando}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
      >
        {enviando ? progresso || "Enviando…" : "Enviar fotos/vídeos"}
      </button>
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
