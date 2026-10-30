/** Armazenamento dos arquivos ORIGINAIS (alta resolução) no Google Drive.
 * Cada fotógrafo pode conectar o próprio Drive (ver /api/drive/connect) —
 * nesse caso usamos o refresh_token dele, salvo em photographers.drive_*.
 * Quem ainda não conectou continua usando a conta do administrador
 * (GOOGLE_REFRESH_TOKEN no .env), igual ao comportamento original. Os
 * previews com marca d'água continuam no Cloudflare R2 (ver src/lib/r2.ts),
 * que já é público e rápido pra exibir na galeria.
 *
 * Usa chamadas diretas à API REST do Drive (sem o pacote `googleapis`) pra
 * manter a dependência leve. Credenciais: ver README.md > "Configurando o
 * Google Drive". */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

/** Credenciais de qual Drive usar. `refreshToken`/`rootFolderId` ausentes ou
 * nulos caem no fallback da conta do administrador (compatibilidade). */
export type DriveAccount = { refreshToken?: string | null; rootFolderId?: string | null };

const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

async function getAccessToken(refreshToken?: string | null): Promise<string> {
  const token = refreshToken || process.env.GOOGLE_REFRESH_TOKEN!;
  const cacheKey = token;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.accessToken;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("falha ao renovar token do Google Drive: " + (await res.text()));
  const data = await res.json();
  tokenCache.set(cacheKey, { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 });
  return data.access_token;
}

async function findFolder(token: string, name: string, parentId: string): Promise<string | null> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const res = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

async function createFolder(token: string, name: string, parentId: string): Promise<string> {
  const res = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  if (!res.ok) throw new Error("falha ao criar pasta no Drive: " + (await res.text()));
  const created = await res.json();
  return created.id;
}

/** Chamado uma vez, logo depois do fotógrafo autorizar o próprio Drive:
 * garante a pasta raiz "Titan Galeria" na raiz do Drive dele (idempotente —
 * se ele desconectar e conectar de novo, reaproveita a mesma pasta). */
export async function ensureDriveRoot(refreshToken: string): Promise<string> {
  const token = await getAccessToken(refreshToken);
  const existing = await findFolder(token, "Titan Galeria", "root");
  if (existing) return existing;
  return createFolder(token, "Titan Galeria", "root");
}

/** Pega os dados básicos da conta Google conectada (pra mostrar "conectado
 * como fulano@gmail.com" nas configurações). */
export async function getDriveAccountEmail(refreshToken: string): Promise<string | null> {
  const token = await getAccessToken(refreshToken);
  const res = await fetch(`${DRIVE_API}/about?fields=user(emailAddress)`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user?.emailAddress ?? null;
}

/** Garante (criando se preciso) a pasta de uma tag (ex: "Aniversário") direto
 * dentro da raiz "Titan Galeria" do fotógrafo. Reaproveita se já existir uma
 * com esse nome, pra próxima galeria com a mesma tag cair no mesmo lugar. */
export async function ensureTagFolder(account: DriveAccount, tagName: string): Promise<string> {
  const token = await getAccessToken(account.refreshToken);
  const rootFolderId = account.rootFolderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;
  const existing = await findFolder(token, tagName, rootFolderId);
  if (existing) return existing;
  return createFolder(token, tagName, rootFolderId);
}

/** Garante (criando se preciso) a pasta da galeria — dentro da pasta da tag,
 * se a galeria tiver uma, senão direto na raiz "Titan Galeria". Idempotente:
 * se já existe uma pasta com esse nome ali dentro, reaproveita. */
export async function ensureGalleryFolder(account: DriveAccount, galleryId: string, galleryTitle: string, parentFolderId?: string | null): Promise<string> {
  const token = await getAccessToken(account.refreshToken);
  const rootFolderId = parentFolderId || account.rootFolderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;
  const folderName = `${galleryTitle} (${galleryId.slice(0, 8)})`;

  const existing = await findFolder(token, folderName, rootFolderId);
  if (existing) return existing;
  return createFolder(token, folderName, rootFolderId);
}

/** Inicia uma sessão de upload resumível do Drive — o navegador do
 * fotógrafo envia o arquivo original direto pro Drive (sem passar pelo
 * nosso servidor), igual ao fluxo de URL assinada que já usamos com o R2. */
export async function createDriveUploadSession(account: DriveAccount, folderId: string, fileName: string, mimeType: string, sizeBytes: number) {
  const token = await getAccessToken(account.refreshToken);
  const res = await fetch(`${DRIVE_UPLOAD_API}?uploadType=resumable&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType || "application/octet-stream",
      "X-Upload-Content-Length": String(sizeBytes),
    },
    body: JSON.stringify({ name: fileName, parents: [folderId] }),
  });
  if (!res.ok) throw new Error("falha ao iniciar upload no Drive: " + (await res.text()));
  const uploadUrl = res.headers.get("Location");
  if (!uploadUrl) throw new Error("Drive não retornou URL de upload");
  return uploadUrl;
}

/** Confere a mesma sessão quando o Drive recebe o arquivo mas o navegador
 * perde a resposta. Não cria outro arquivo nem recebe o original no servidor. */
export async function queryDriveUpload(account: DriveAccount, uploadUrl: string, sizeBytes: number) {
  const token = await getAccessToken(account.refreshToken);
  const res = await fetch(uploadUrl, {
    method: "PUT", redirect: "manual", cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Range": `bytes */${sizeBytes}`, "Content-Length": "0" },
    signal: AbortSignal.timeout(20000),
  });
  if (res.ok) {
    const data = await res.json();
    if (typeof data.id !== "string" || !data.id) throw new Error("Drive sem ID do arquivo");
    return { complete: true as const, fileId: data.id, receivedBytes: sizeBytes };
  }
  if (res.status === 308) {
    const range = /^bytes=0-(\d+)$/.exec(res.headers.get("range") || "");
    const receivedBytes = range ? Number(range[1]) + 1 : 0;
    if (!Number.isSafeInteger(receivedBytes) || receivedBytes > sizeBytes) throw new Error("intervalo inválido");
    return { complete: false as const, receivedBytes };
  }
  if (res.status === 404 || res.status === 410) return { complete: false as const, expired: true, receivedBytes: 0 };
  throw new Error("falha ao conferir envio no Drive");
}

/** Baixa o conteúdo de um arquivo original — só chamado depois de pagamento
 * confirmado, via proxy do nosso servidor (o arquivo nunca fica público no
 * Drive). Retorna o Response cru pra podermos repassar o body como stream. */
export async function fetchDriveFileStream(account: DriveAccount, fileId: string) {
  const token = await getAccessToken(account.refreshToken);
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("falha ao baixar arquivo do Drive: " + (await res.text()));
  return res;
}

export async function getDriveFileMeta(account: DriveAccount, fileId: string) {
  const token = await getAccessToken(account.refreshToken);
  const res = await fetch(`${DRIVE_API}/files/${fileId}?fields=name,mimeType,size`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("falha ao buscar metadados no Drive: " + (await res.text()));
  return res.json() as Promise<{ name: string; mimeType: string; size?: string }>;
}

export async function deleteDriveFile(account: DriveAccount, fileId: string) {
  const token = await getAccessToken(account.refreshToken);
  await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Exclui a pasta da galeria inteira no Drive. A API do Drive, ao excluir
 * uma pasta (DELETE, não trashed), já exclui em cascata todos os arquivos
 * que estão dentro dela — não é preciso excluir arquivo por arquivo antes. */
export async function deleteDriveFolder(account: DriveAccount, folderId: string) {
  await deleteDriveFile(account, folderId);
}
