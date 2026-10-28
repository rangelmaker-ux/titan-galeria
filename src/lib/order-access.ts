import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
export function orderTokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function orderCookieName(id: string) { return `titan_order_${id}`; }
export function canReadOrder(req: NextRequest, order: { id: string; payment_method: string; access_token_hash: string | null }) {
  if (order.payment_method !== "manual_pix") return true; // compatibilidade de pedidos Stripe anteriores
  const token = req.cookies.get(orderCookieName(order.id))?.value;
  if (!token || !order.access_token_hash) return false;
  const actual = Buffer.from(orderTokenHash(token));
  const expected = Buffer.from(order.access_token_hash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function whatsappLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return /^\d{10,15}$/.test(normalized) ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` : null;
}
