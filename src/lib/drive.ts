/** Armazenamento dos arquivos ORIGINAIS (alta resolução) no Google Drive da
 * conta do dono da plataforma — igual ao padrão usado no Titan Sounds. Os
 * previews com marca d'água continuam no Cloudflare R2 (ver src/lib/r2.ts),
 * que já é público e rápido pra exibir na galeria.
 *
 * Usa chamadas diretas à API REST do Drive (sem o pacote `googleapis`) pra
 * manter a dependência leve. Credenciais: ver README.md > "Configurando o
 * Google Drive". */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("falha ao renovar token do Google Drive: " + (await res.text()));
  const data = await res.json();
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

/** Garante (criando se preciso) a pasta da galeria dentro da pasta raiz
 * "Titan Galeria" configurada em GOOGLE_DRIVE_ROOT_FOLDER_ID. Idempotente:
 * se já existe uma pasta com esse nome ali dentro, reaproveita. */
export async function ensureGalleryFolder(galleryId: string, galleryTitle: string): Promise<string> {
  const token = await getAccessToken();
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;
  const folderName = `${galleryTitle} (${galleryId.slice(0, 8)})`.replace(/'/g, "\\'");

  const q = encodeURIComponent(
    `'${rootFolderId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const searchRes = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files?.[0]?.id) return searchData.files[0].id;
  }

  const createRes = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootFolderId],
    }),
  });
  if (!createRes.ok) throw new Error("falha ao criar pasta no Drive: " + (await createRes.text()));
  const created = await createRes.json();
  return created.id;
}

/** Inicia uma sessão de upload resumível do Drive — o navegador do
 * fotógrafo envia o arquivo original direto pro Drive (sem passar pelo
 * nosso servidor), igual ao fluxo de URL assinada que já usamos com o R2. */
export async function createDriveUploadSession(folderId: string, fileName: string, mimeType: string) {
  const token = await getAccessToken();
  const res = await fetch(`${DRIVE_UPLOAD_API}?uploadType=resumable&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType || "application/octet-stream",
    },
    body: JSON.stringify({ name: fileName, parents: [folderId] }),
  });
  if (!res.ok) throw new Error("falha ao iniciar upload no Drive: " + (await res.text()));
  const uploadUrl = res.headers.get("Location");
  if (!uploadUrl) throw new Error("Drive não retornou URL de upload");
  return uploadUrl;
}

/** Baixa o conteúdo de um arquivo original — só chamado depois de pagamento
 * confirmado, via proxy do nosso servidor (o arquivo nunca fica público no
 * Drive). Retorna o Response cru pra podermos repassar o body como stream. */
export async function fetchDriveFileStream(fileId: string) {
  const token = await getAccessToken();
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("falha ao baixar arquivo do Drive: " + (await res.text()));
  return res;
}

export async function getDriveFileMeta(fileId: string) {
  const token = await getAccessToken();
  const res = await fetch(`${DRIVE_API}/files/${fileId}?fields=name,mimeType,size`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("falha ao buscar metadados no Drive: " + (await res.text()));
  return res.json() as Promise<{ name: string; mimeType: string; size?: string }>;
}

export async function deleteDriveFile(fileId: string) {
  const token = await getAccessToken();
  await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
