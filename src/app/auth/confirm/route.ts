import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  function destination(path: string) { const response = NextResponse.redirect(new URL(path, request.url)); response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer"); return response; }
  if (!tokenHash || tokenHash.length > 2048 || !["email", "signup"].includes(type || "")) return destination("/auth/confirmacao");
  try {
    const db = createClient();
    const { data, error } = await db.auth.verifyOtp({ token_hash: tokenHash, type: type as "email" | "signup" });
    if (error || !data.session) return destination("/auth/confirmacao");
    const { error: claimError } = await db.rpc("claim_titan_purchase");
    return destination(claimError ? "/painel/assinatura" : "/painel");
  } catch { return destination("/auth/confirmacao"); }
}
