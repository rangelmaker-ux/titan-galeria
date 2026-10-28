"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { jsonRequest, preparePhoto, sendBlob, uploadOriginal, type DriveSession } from "@/lib/upload-client";

type Props = { galleryId: string; watermarkText: string; watermarkEnabled: boolean; plano?: string };
type Item = {
  id: number; file: File; percent: number; phase: string; status: "waiting" | "sending" | "done" | "error";
  error?: string; previewKey?: string; driveFileId?: string; session?: DriveSession; width?: number; height?: number;
};
export function Uploader({ galleryId, watermarkText, watermarkEnabled, plano }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const queue = useRef<Item[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [enviando, setEnviando] = useState(false);
  const publish = () => setItems(queue.current.map((item) => ({ ...item })));
  const update = (item: Item, percent: number, phase: string) => { item.percent = Math.max(item.percent, Math.min(99, percent)); item.phase = phase; publish(); };

  async function enviar(item: Item) {
    item.status = "sending"; item.error = undefined; publish();
    try {
      const file = item.file;
      const video = file.type.startsWith("video/");
      if (!file.type.startsWith("image/") && !video) throw new Error("Selecione uma foto ou um vídeo compatível.");
      if (!file.size) throw new Error("O arquivo está vazio.");
      if (plano === "gratuito" && video && file.size > 15 * 1024 * 1024) throw new Error("O plano gratuito permite vídeos de até 15 MB.");
      if (!item.previewKey) {
        update(item, 2, video ? "Preparando vídeo" : "Preparando prévia");
        if (!video) {
          const photo = await preparePhoto(file, watermarkEnabled ? watermarkText : null);
          item.width = photo.width; item.height = photo.height;
          update(item, 5, "Enviando prévia");
          const preview = await sendBlob(`/api/upload/preview?galleryId=${encodeURIComponent(galleryId)}`, photo.blob, { method: "POST", contentType: "image/jpeg", onProgress: (fraction) => update(item, 5 + fraction * 10, "Salvando prévia") });
          if (typeof preview.key !== "string") throw new Error("O servidor não confirmou a prévia.");
          item.previewKey = preview.key;
        } else {
          const preview = await jsonRequest<{ uploadUrl: string; key: string }>("/api/upload/presign", { galleryId, fileName: file.name, contentType: file.type, variant: "preview" });
          await sendBlob(preview.uploadUrl, file, { contentType: file.type, onProgress: (fraction) => update(item, 5 + fraction * 35, "Enviando prévia do vídeo") });
          item.previewKey = preview.key;
        }
      }
      if (!item.driveFileId) {
        const resume = !!item.session;
        update(item, video ? 40 : 15, resume ? "Conferindo envio anterior" : "Preparando original");
        item.session ??= await jsonRequest<DriveSession>("/api/upload/drive-session", { galleryId, fileName: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size });
        item.driveFileId = await uploadOriginal(galleryId, item.session, file, (fraction) => update(item, (video ? 40 : 15) + fraction * (video ? 55 : 80), "Enviando original ao Drive"), resume);
      }
      update(item, 98, "Registrando na galeria");
      await jsonRequest(`/api/galerias/${galleryId}/media`, { driveFileId: item.driveFileId, previewKey: item.previewKey, type: video ? "video" : "photo", sizeBytes: file.size, width: item.width, height: item.height });
      item.percent = 100; item.status = "done"; item.phase = "Enviado";
    } catch (error) {
      item.status = "error"; item.error = error instanceof Error ? error.message : "Não foi possível concluir o envio.";
    } finally { publish(); }
  }

  async function run(pending: Item[]) {
    if (busy.current) return;
    busy.current = true; setEnviando(true);
    let next = 0;
    async function worker() { while (next < pending.length) await enviar(pending[next++]); }
    try { await Promise.all(Array.from({ length: Math.min(2, pending.length) }, worker)); }
    finally { busy.current = false; setEnviando(false); router.refresh(); }
  }
  function handleFiles(files: FileList) {
    if (busy.current || !files.length) return;
    queue.current = Array.from(files, (file, id) => ({ id, file, percent: 0, phase: "Na fila", status: "waiting" as const }));
    publish(); void run(queue.current);
    if (inputRef.current) inputRef.current.value = "";
  }
  const complete = items.filter((item) => item.status === "done").length;
  const failed = items.filter((item) => item.status === "error");
  const percent = items.length ? Math.floor(items.reduce((sum, item) => sum + item.percent, 0) / items.length) : 0;
  return (
    <div className="w-full min-w-0 max-w-2xl">
      <input ref={inputRef} type="file" multiple accept="image/*,video/*" className="hidden" disabled={enviando} onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      <button type="button" disabled={enviando} onClick={() => inputRef.current?.click()} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-50">{enviando ? "Enviando arquivos…" : "Enviar fotos/vídeos"}</button>
      {!!items.length && <section aria-label="Progresso dos envios" className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm"><p role="status">{items.length === 1 ? items[0].file.name : `${complete} de ${items.length} arquivos enviados`}</p><span className="shrink-0 font-semibold tabular-nums">{percent}%</span></div>
        <progress className="block h-2 w-full overflow-hidden rounded-full accent-ink" aria-label="Progresso total do envio" max={100} value={percent} />
        <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto">
          {items.map((item) => <li key={item.id} className="text-xs"><div className="mb-1 flex justify-between gap-3"><span className="min-w-0 truncate" title={item.file.name}>{item.file.name}</span><span className={`shrink-0 ${item.status === "error" ? "text-red-700" : "text-neutral-500"}`}>{item.status === "error" ? "Não concluído" : `${item.phase} · ${Math.floor(item.percent)}%`}</span></div>{items.length > 1 && <progress aria-label={`Envio de ${item.file.name}`} max={100} value={item.percent} className="block h-1 w-full accent-ink" />}{item.error && <p role="alert" className="mt-1 text-red-700">{item.error}</p>}</li>)}
        </ul>
        {!enviando && complete === items.length && <p role="status" className="mt-3 text-sm text-green-700">{items.length === 1 ? "Arquivo enviado e disponível na galeria." : "Todos os arquivos estão disponíveis na galeria."}</p>}
        {!enviando && failed.length > 0 && <button type="button" onClick={() => void run(queue.current.filter((item) => item.status === "error"))} className="mt-4 rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium">Tentar novamente ({failed.length})</button>}
      </section>}
    </div>
  );
}
