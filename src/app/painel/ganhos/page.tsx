import { createClient } from "@/lib/supabase/server";
import { OrderCard, type SalesOrder } from "@/components/order-card";
import { ReceivingForm } from "./receiving-form";
export const dynamic = "force-dynamic";
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
export default async function GanhosPage() {
  const db = createClient(); const { data: { user } } = await db.auth.getUser();
  const [{ data: photographer }, { data: orders, error }] = await Promise.all([
    db.from("photographers").select("pix_key, whatsapp").eq("id", user?.id).single(),
    db.from("orders").select("id, total_cents, status, paid_at, client_identifier, created_at, payment_method, galleries(title), order_items(media_id, product_name, product_type, media(r2_key_preview))").eq("payment_method", "manual_pix").order("created_at", { ascending: false }),
  ]);
  const pending = orders?.filter((o) => o.status === "pending") || [];
  const paid = orders?.filter((o) => o.status === "paid" || o.status === "fulfilled") || [];
  return <div className="max-w-5xl space-y-6"><header><h1 className="text-2xl font-semibold">Meus ganhos e pedidos</h1><p className="mt-2 text-sm text-neutral-600">Receba diretamente dos seus clientes e controle a liberação dos arquivos.</p></header>
    <ReceivingForm pixKey={photographer?.pix_key} whatsapp={photographer?.whatsapp} />
    <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl border bg-white p-5"><p className="text-sm text-neutral-500">Pix confirmados por você</p><p className="mt-2 text-2xl font-semibold">{money(paid.reduce((sum, o) => sum + o.total_cents, 0))}</p></div><div className="rounded-xl border bg-white p-5"><p className="text-sm text-neutral-500">Aguardando sua conferência</p><p className="mt-2 text-2xl font-semibold">{pending.length} pedidos</p></div><div className="rounded-xl border bg-white p-5"><p className="text-sm text-neutral-500">Valor dos pedidos pendentes</p><p className="mt-2 text-2xl font-semibold">{money(pending.reduce((sum, o) => sum + o.total_cents, 0))}</p></div></div>
    <aside className="rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">Confira o crédito na sua conta bancária e o nome do pagador antes de liberar. Receber um comprovante no WhatsApp não confirma o pagamento automaticamente. O total acima é um registro das suas confirmações, não uma consulta ao banco.</aside>
    <section><h2 className="mb-3 text-lg font-semibold">Pedidos dos seus clientes</h2>{error ? <p role="alert">Não foi possível carregar os pedidos.</p> : !orders?.length ? <p className="text-sm text-neutral-500">Nenhum pedido direto ainda. Cadastre Pix e WhatsApp, vincule um produto à galeria e compartilhe o link.</p> : <div className="space-y-3">{orders.map((o) => <OrderCard key={o.id} order={o as unknown as SalesOrder} />)}</div>}</section></div>;
}
