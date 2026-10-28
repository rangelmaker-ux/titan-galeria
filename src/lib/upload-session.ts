import { createHmac, timingSafeEqual } from "node:crypto";

type UploadSession = { uploadUrl: string; userId: string; galleryId: string; sizeBytes: number; expiresAt: number };
function signature(payload: string) {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("Google Drive não configurado");
  return createHmac("sha256", secret).update(`titan-drive-upload:${payload}`).digest("base64url");
}
export function signUploadSession(session: Omit<UploadSession, "expiresAt">) {
  const payload = Buffer.from(JSON.stringify({ ...session, expiresAt: Date.now() + 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function readUploadSession(token: string, userId: string, galleryId: string): UploadSession | null {
  try {
    const [payload, signed, extra] = token.split(".");
    if (!payload || !signed || extra) return null;
    const expected = Buffer.from(signature(payload));
    const actual = Buffer.from(signed);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const session: UploadSession = JSON.parse(Buffer.from(payload, "base64url").toString());
    const url = new URL(session.uploadUrl);
    if (session.userId !== userId || session.galleryId !== galleryId || session.expiresAt <= Date.now() ||
      !Number.isSafeInteger(session.sizeBytes) || session.sizeBytes <= 0 ||
      url.protocol !== "https:" || url.hostname !== "www.googleapis.com" || url.pathname !== "/upload/drive/v3/files") return null;
    return session;
  } catch { return null; }
}
