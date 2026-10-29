import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Cloudflare R2 é compatível com a API S3 — usamos o SDK da AWS apontando
 * pro endpoint do R2. Credenciais: ver README.md > "Configurando o R2". */
export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// IMPORTANTE: dois buckets separados.
// - R2_BUCKET_PRIVATE: arquivos originais em alta resolução. Nunca público —
//   só acessado via URL assinada (download pago) ou pelo servidor.
// - R2_BUCKET_PUBLIC: previews com marca d'água / resolução reduzida. Esse
//   bucket deve ter acesso público habilitado (r2.dev ou domínio próprio no
//   Cloudflare) — ver README > "Configurando o R2".
const PRIVATE_BUCKET = process.env.R2_BUCKET_PRIVATE!;
const PUBLIC_BUCKET = process.env.R2_BUCKET_PUBLIC!;

/** Gera uma URL assinada de PUT pro navegador subir o arquivo direto pro R2
 * (sem passar pelo servidor Next.js). Expira em 10 minutos. */
export async function createUploadUrl(
  key: string,
  contentType: string,
  variant: "original" | "preview"
) {
  const command = new PutObjectCommand({
    Bucket: variant === "original" ? PRIVATE_BUCKET : PUBLIC_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2, command, { expiresIn: 600 });
}

/** URL assinada de leitura (GET) com expiração curta — usada pra entregar
 * downloads pagos (o original em alta resolução nunca fica público). */
export async function createDownloadUrl(key: string, expiresInSeconds = 300) {
  const command = new GetObjectCommand({ Bucket: PRIVATE_BUCKET, Key: key });
  return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}

export async function deleteOriginal(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: PRIVATE_BUCKET, Key: key }));
}

export async function deletePreview(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key }));
}

/** Somente a prévia JPEG reduzida passa pelo servidor, nunca o original. */
export async function storePhotoPreview(key: string, body: Uint8Array) {
  await r2.send(new PutObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key, Body: body, ContentType: "image/jpeg" }));
}

/** Versão genérica pra arquivos públicos que não são prévia JPEG (ex: a
 * logo da marca d'água, que pode ser PNG/WebP com transparência). */
export async function storePublicImage(key: string, body: Uint8Array, contentType: string) {
  await r2.send(new PutObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key, Body: body, ContentType: contentType }));
}

/** URL pública (sem assinatura) pras previews com marca d'água / resolução
 * reduzida — essas sim podem ficar num bucket/domínio público via R2.dev
 * ou um domínio customizado configurado no Cloudflare. */
export function publicPreviewUrl(key: string) {
  const base = process.env.R2_PUBLIC_BASE_URL!; // ex: https://media.titangaleria.com
  return `${base.replace(/\/$/, "")}/${key}`;
}

export function mediaKey(galleryId: string, fileName: string, variant: "original" | "preview") {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `galerias/${galleryId}/${variant}/${crypto.randomUUID()}-${safe}`;
}

/** Chave pra foto de perfil do fotógrafo — sempre no bucket público
 * (é exibida no portfólio público /p/<slug>). */
export function avatarKey(photographerId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `avatares/${photographerId}/${crypto.randomUUID()}-${safe}`;
}

/** Chave pra logo da marca d'água do fotógrafo — sempre no bucket público
 * (precisa ser lida de volta pelo navegador na hora de marcar as fotos). */
export function watermarkLogoKey(photographerId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `marcas/${photographerId}/${crypto.randomUUID()}-${safe}`;
}
