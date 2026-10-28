"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LAYOUT_GRID, LAYOUT_ITEM, type GalleryTemplate } from "@/lib/gallery-layout";

type Midia = { id: string; type: "photo" | "video"; previewUrl: string };
type Produto = { id: string; type: "download_single" | "download_all" | "print"; name: string; price_cents: number; currency: string; print_size: string | null };
type Props = { shareToken: string; title: string; clientName: string | null; allowFavorites: boolean; allowDownloads: boolean; midias: Midia[]; produtos: Produto[]; pedidoStatus?: string; orderId?: string; marcaTitan?: boolean; template?: GalleryTemplate; aoVivo?: boolean };
type Order = { status: string; clientName?: string; totalCents: number; pixKey: string; whatsappUrl: string | null; items?: { media_id: string; product_name: string; product_type: string }[]; links: { mediaId: string; url: string }[] };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const fullName = (name: string) => name.trim().split(/\s+/).length >= 2 && name.trim().length >= 3;
function Brand({ show }: { show?: boolean }) { return show ? <p className="mt-8 pb-6 text-center text-xs text-neutral-400">Feito com <a href="/" className="underline">Titan Galeria</a></p> : null; }
function Live({ enabled }: { enabled?: boolean }) { return enabled ? <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600"/>AO VIVO</span> : null; }
export function ClientGalleryView({ shareToken, title, clientName, allowFavorites, produtos, midias, orderId: initialOrderId, marcaTitan, template = "grid", aoVivo }: Props) {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null); const [nameInput, setNameInput] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set()); const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState(initialOrderId || ""); const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<string[]>([]); const [copied, setCopied] = useState(false);
  const request = useRef<{ key: string; requestId: string; accessToken: string } | null>(null);
  const paymentHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { try { const stored = localStorage.getItem(`titan_galeria_id_${shareToken}`); if (stored && fullName(stored)) setName(stored); const ids = JSON.parse(localStorage.getItem(`titan_pedidos_${shareToken}`) || "[]"); if (Array.isArray(ids)) setHistory(ids.filter((v) => typeof v === "string").slice(0, 20)); } catch { /* armazenamento pode estar indisponível */ } }, [shareToken]);
  useEffect(() => { if (!aoVivo) return; const timer = setInterval(() => router.refresh(), 15000); return () => clearInterval(timer); }, [aoVivo, router]);
  useEffect(() => {
    if (!orderId) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>; let attempts = 0;
    setOrder(null);
    async function check() {
      clearTimeout(timer);
      if (document.visibilityState === "hidden") { timer = setTimeout(check, 30000); return; }
      try {
        const res = await fetch(`/api/downloads/${orderId}`, { cache: "no-store", signal: controller.signal }); const data = await res.json();
        if (controller.signal.aborted) return;
        if (!res.ok) { setError(data.error || "Não foi possível consultar o pedido."); return; }
        setOrder(data);
        if (data.status === "pending") timer = setTimeout(check, ++attempts <= 3 ? 5000 : 30000);
      } catch { if (!controller.signal.aborted) { setError("Falha de conexão ao consultar o pedido. Use Atualizar pedido."); } }
    }
    function resume() { if (document.visibilityState === "visible") void check(); }
    void check(); document.addEventListener("visibilitychange", resume);
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", resume); };
  }, [orderId]);
  async function refreshOrder() { if (!orderId) return; setError(null); try { const res = await fetch(`/api/downloads/${orderId}`, { cache: "no-store" }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setOrder(data); } catch (e) { setError(e instanceof Error ? e.message : "Falha de conexão."); } }
  function identify(e: React.FormEvent) { e.preventDefault(); if (!fullName(nameInput)) { setError("Informe nome e sobrenome como aparecem no comprovante do Pix."); return; } const value = nameInput.trim().replace(/\s+/g, " "); setName(value); setError(null); try { localStorage.setItem(`titan_galeria_id_${shareToken}`, value); } catch {} }
  async function favorite(id: string) { if (!name) return; const value = !favorites.has(id); setFavorites((old) => { const next = new Set(old); value ? next.add(id) : next.delete(id); return next; }); try { await fetch(`/api/galeria-publica/${shareToken}/selecionar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId: id, clientIdentifier: name, favorited: value }) }); } catch { setError("Não foi possível salvar o favorito."); } }
  function toggle(id: string) { setSelected((old) => { const next = new Set(old); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  async function buy(product: Produto, ids: string[]) {
    if (!name || busy) return; setBusy(true); setError(null); setCopied(false);
    const key = JSON.stringify([shareToken, product.id, ids.slice().sort(), name]);
    if (request.current?.key !== key) request.current = { key, requestId: crypto.randomUUID(), accessToken: Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) => n.toString(16).padStart(2, "0")).join("") };
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shareToken, productId: product.id, mediaIds: ids, clientIdentifier: name, requestId: request.current.requestId, accessToken: request.current.accessToken }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Não foi possível criar o pedido.");
      request.current = null; setOrderId(data.orderId);
      const idsHistory = [data.orderId, ...history.filter((id) => id !== data.orderId)].slice(0, 20); setHistory(idsHistory);
      try { localStorage.setItem(`titan_pedidos_${shareToken}`, JSON.stringify(idsHistory)); } catch {}
      setTimeout(() => paymentHeading.current?.focus(), 0);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha de conexão. Tente novamente."); }
    finally { setBusy(false); }
  }
  if (!name) return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-8"><Live enabled={aoVivo}/><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-3 text-sm leading-relaxed text-neutral-600">Para escolher e comprar arquivos, informe seu nome completo <strong>exatamente como aparece no comprovante do Pix</strong>. O profissional usará esse nome para conferir seu pagamento.</p><form onSubmit={identify} className="mt-6 space-y-3"><label className="block text-sm">Nome completo<input required autoComplete="name" maxLength={200} value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Nome e sobrenome do pagador" className="mt-2 block w-full rounded-lg border px-4 py-3"/></label><button className="w-full rounded-full bg-ink px-5 py-3 text-sm text-paper">Ver galeria</button></form>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<Brand show={marcaTitan}/></main>;
  const individual = produtos.find((p) => p.type === "download_single"); const packages = produtos.filter((p) => p.type === "download_all"); const prints = produtos.filter((p) => p.type === "print");
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><header className="mb-6"><Live enabled={aoVivo}/><h1 className="text-2xl font-semibold">{title}</h1>{clientName && <p className="mt-1 text-sm text-neutral-500">{clientName}</p>}<p className="mt-3 text-sm text-neutral-600">Olá, {name}. <button className="underline" onClick={() => { setNameInput(name); setName(null); }}>Corrigir nome do pagador</button></p></header>
    {!!produtos.length && <aside className="mb-6 rounded-xl bg-neutral-100 p-4 text-sm leading-relaxed">Escolha os arquivos ou o pacote desta galeria. Você paga o Pix <strong>diretamente ao profissional</strong>, envia o comprovante pelo WhatsApp e aguarda a liberação manual dos downloads.</aside>}
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {!!history.length && <label className="mb-5 block text-sm">Meus pedidos neste navegador<select value={orderId} onChange={(e) => { setOrderId(e.target.value); setError(null); }} className="ml-2 rounded-lg border px-3 py-2"><option value="">Selecione um pedido</option>{history.map((id) => <option key={id} value={id}>Pedido {id.slice(0, 8)}</option>)}</select></label>}
    {orderId && <section className="mb-8 rounded-2xl border bg-white p-5"><h2 ref={paymentHeading} tabIndex={-1} className="text-lg font-semibold">Pedido {orderId.slice(0, 8)}</h2>{!order ? <p role="status" className="mt-3 text-sm">Consultando pedido…</p> : <><p className="mt-2 text-sm">{order.clientName || name} · <strong>{money(order.totalCents || 0)}</strong> · {order.items?.length || order.links.length} arquivos</p><p className="mt-1 text-xs text-neutral-500">{order.items?.[0]?.product_name}</p>{order.status === "pending" ? <><ol className="mt-4 list-inside list-decimal space-y-2 text-sm"><li>Confira o total e pague para a chave Pix abaixo.</li><li>Envie o comprovante no WhatsApp do profissional.</li><li>Aguarde a conferência e a liberação deste pedido.</li></ol><div className="mt-4 rounded-lg bg-neutral-50 p-4"><p className="text-xs text-neutral-500">Chave Pix do profissional</p><p className="mt-1 break-all font-medium">{order.pixKey}</p><button className="mt-2 text-sm underline" onClick={async () => { try { await navigator.clipboard.writeText(order.pixKey); setCopied(true); } catch { setError("Selecione e copie a chave Pix exibida acima."); } }}>{copied ? "Chave copiada" : "Copiar chave Pix"}</button></div>{order.whatsappUrl && <a target="_blank" rel="noopener noreferrer" href={order.whatsappUrl} className="mt-4 inline-block rounded-full bg-green-700 px-5 py-2.5 text-sm text-white">Enviar comprovante no WhatsApp</a>}<p role="status" className="mt-4 text-sm text-amber-800">Aguardando o profissional confirmar o recebimento. O comprovante não libera arquivos automaticamente.</p></> : order.status === "canceled" ? <p className="mt-4 text-sm text-red-700">Pedido cancelado. Fale com o profissional se já realizou o pagamento.</p> : <div className="mt-4"><p role="status" className="text-sm font-medium text-green-800">Pagamento conferido pelo profissional.</p>{order.links.length ? <div className="mt-3 flex flex-wrap gap-2">{order.links.map((link, i) => <a key={link.mediaId} href={link.url} className="rounded-lg border px-4 py-2 text-sm underline">Baixar arquivo {i + 1}</a>)}</div> : <p className="mt-2 text-sm">Impressão confirmada. Combine a produção e a entrega com o profissional.</p>}</div>}<button onClick={() => void refreshOrder()} className="mt-4 block text-sm underline">Atualizar pedido</button><p className="mt-3 text-xs text-neutral-500">Volte a este mesmo navegador para consultar o pedido e baixar os arquivos liberados.</p></>}</section>}
    {!!packages.length && <div className="mb-6 flex flex-wrap gap-3">{packages.map((p) => <button key={p.id} disabled={busy || !midias.length} onClick={() => void buy(p, [])} className="rounded-full bg-ink px-5 py-3 text-sm text-paper disabled:opacity-50">{p.name} · {money(p.price_cents)} · Pedir via Pix</button>)}</div>}
    {individual && <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3 shadow-sm"><p className="text-sm">{selected.size} arquivos selecionados · {money(individual.price_cents)} por arquivo</p><button disabled={busy || !selected.size} onClick={() => void buy(individual, [...selected])} className="rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50">Pedir selecionados · {money(individual.price_cents * selected.size)}</button></div>}
    <div className={LAYOUT_GRID[template]}>{midias.map((m, index) => <article key={m.id} className={`group relative overflow-hidden rounded-lg bg-neutral-100 ${LAYOUT_ITEM[template]}`}>{m.type === "photo" ? <img src={m.previewUrl} alt={`Foto ${index + 1}`} loading="lazy" className={template === "grid" ? "h-full w-full object-cover" : "h-auto w-full object-cover"}/> : <video src={m.previewUrl} controls className={template === "grid" ? "h-full w-full object-cover" : "h-auto w-full object-cover"}/>}<div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-black/70 p-2 text-xs text-white">{individual && <label className="flex items-center gap-2"><input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)}/>Selecionar {index + 1}</label>}{prints.filter(() => m.type === "photo").map((p) => <button disabled={busy} key={p.id} onClick={() => void buy(p, [m.id])} className="rounded bg-white px-2 py-1 text-ink">{p.name} · {money(p.price_cents)}</button>)}</div>{allowFavorites && <button aria-label={`Favoritar arquivo ${index + 1}`} onClick={() => void favorite(m.id)} className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-2 text-white">{favorites.has(m.id) ? "♥" : "♡"}</button>}</article>)}</div>{!midias.length && <p className="py-10 text-center text-sm text-neutral-500">As fotos ainda serão enviadas pelo profissional.</p>}<Brand show={marcaTitan}/></main>;
}
