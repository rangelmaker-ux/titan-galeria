export async function jsonRequest<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try { res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
  catch { throw new Error("Falha de conexão com o site. Verifique sua internet e tente novamente."); }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `O servidor não concluiu a solicitação (HTTP ${res.status}).`);
  if (!data) throw new Error("O servidor retornou uma resposta inválida.");
  return data as T;
}

/** XHR expõe os bytes enviados; fetch não informa progresso de upload. */
export function sendBlob(url: string, blob: Blob, options: {
  method?: "PUT" | "POST"; contentType: string; onProgress: (fraction: number) => void; contentRange?: string;
}): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method || "PUT", url);
    xhr.timeout = 10 * 60 * 1000;
    xhr.setRequestHeader("Content-Type", options.contentType);
    if (options.contentRange) xhr.setRequestHeader("Content-Range", options.contentRange);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) options.onProgress(Math.min(1, event.loaded / event.total)); };
    xhr.onerror = () => reject(new Error("A conexão foi interrompida durante o envio."));
    xhr.ontimeout = () => reject(new Error("O envio demorou demais. Verifique a conexão e tente novamente."));
    xhr.onabort = () => reject(new Error("Envio interrompido."));
    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch { /* PUT do R2 pode não retornar JSON. */ }
      if (xhr.status >= 200 && xhr.status < 300) { options.onProgress(1); resolve(data); }
      else reject(new Error(typeof data.error === "string" ? data.error : `O armazenamento recusou o envio (HTTP ${xhr.status}).`));
    };
    xhr.send(blob);
  });
}

/** Uma única decodificação; limita o lado maior e libera a URL temporária. */
export async function preparePhoto(file: File, watermark: string | null, maxSide = 1600) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Não foi possível abrir esta imagem. Tente uma foto JPEG, PNG ou WebP."));
      img.src = url;
    });
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Seu navegador não conseguiu preparar a imagem.");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (watermark) {
      ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = "#ffffff";
      ctx.font = `${Math.max(12, Math.round(canvas.width / 18))}px sans-serif`;
      ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(-Math.PI / 8); ctx.textAlign = "center";
      for (let y = -canvas.height; y < canvas.height; y += Math.max(1, canvas.width / 4)) ctx.fillText(watermark, 0, y);
      ctx.restore();
    }
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Não foi possível preparar a prévia.")), "image/jpeg", 0.82));
    canvas.width = 0; canvas.height = 0;
    if (blob.size > 3 * 1024 * 1024) throw new Error("A prévia ficou muito grande. Tente outra imagem.");
    return { blob, width, height };
  } finally { URL.revokeObjectURL(url); }
}

export type DriveSession = { uploadUrl: string; token: string };
type DriveStatus = { complete: boolean; fileId?: string; receivedBytes: number; expired?: boolean };
export async function uploadOriginal(galleryId: string, session: DriveSession, file: File, onProgress: (fraction: number) => void, resume = false): Promise<string> {
  let offset = 0;
  if (resume) {
    const status = await jsonRequest<DriveStatus>("/api/upload/drive-status", { galleryId, token: session.token });
    if (status.complete && status.fileId) { onProgress(1); return status.fileId; }
    if (status.expired) throw new Error("A sessão do Drive expirou. Selecione o arquivo novamente.");
    offset = status.receivedBytes;
  }
  try {
    const data = await sendBlob(session.uploadUrl, file.slice(offset), {
      contentType: file.type || "application/octet-stream",
      onProgress: (fraction) => onProgress((offset + fraction * (file.size - offset)) / file.size),
      contentRange: offset ? `bytes ${offset}-${file.size - 1}/${file.size}` : undefined,
    });
    if (typeof data.id === "string" && data.id) return data.id;
  } catch { /* O Drive pode ter recebido o arquivo sem o navegador ler a resposta. */ }
  const status = await jsonRequest<DriveStatus>("/api/upload/drive-status", { galleryId, token: session.token });
  if (status.complete && status.fileId) { onProgress(1); return status.fileId; }
  throw new Error(status.expired ? "A sessão do Drive expirou. Selecione o arquivo novamente." : "O original ainda não terminou de chegar ao Drive. Use Tentar novamente para continuar o envio.");
}
