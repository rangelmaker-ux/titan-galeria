"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LAYOUT_GRID, LAYOUT_ITEM, type GalleryTemplate } from "@/lib/gallery-layout";

type Galeria = {
  id: string; is_published: boolean; allow_favorites: boolean; allow_downloads: boolean;
  watermark_previews: boolean; password_hash: string | null; template: GalleryTemplate; realtime_mode: boolean;
};
const TEMPLATES: { value: GalleryTemplate; label: string; descricao: string }[] = [
  { value: "grid", label: "Grade", descricao: "Fotos em quadrados do mesmo tamanho." },
  { value: "masonry", label: "Mosaico", descricao: "Fotos em colunas, preservando as proporções." },
  { value: "minimal", label: "Minimalista", descricao: "Uma foto grande por linha, com mais respiro." },
];
const SAMPLE_PHOTOS = ["casamento", "familia", "15-anos", "natal", "dia-das-criancas", "casamento"].map((name) => `/images/landing/${name}.jpg`);
function MiniLayout({ template, photos }: { template: GalleryTemplate; photos: string[] }) {
  return <div aria-hidden="true" className={`h-24 overflow-hidden rounded-md bg-neutral-100 p-2 ${template === "minimal" ? "flex flex-col items-center gap-2" : template === "masonry" ? "columns-3 gap-1" : "grid grid-cols-3 gap-1"}`}>
    {photos.slice(0, 6).map((src, i) => <img key={`${src}-${i}`} src={src} alt="" loading="lazy" className={template === "minimal" ? "h-16 w-3/4 shrink-0 rounded object-cover" : template === "masonry" ? `mb-1 w-full rounded object-cover ${i % 2 ? "h-8" : "h-12"}` : "h-full min-h-0 w-full rounded object-cover"} />)}
  </div>;
}

export function GallerySettingsForm({ galeria, previewPhotos = [] }: { galeria: Galeria; previewPhotos?: string[] }) {
  const router = useRouter();
  const [settings, setSettings] = useState(galeria);
  const [salvando, setSalvando] = useState(false);
  const [senha, setSenha] = useState("");
  const [draft, setDraft] = useState<GalleryTemplate>(galeria.template);
  const [hovered, setHovered] = useState<GalleryTemplate | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const photos = previewPhotos.length ? previewPhotos : SAMPLE_PHOTOS;
  const preview = hovered || draft;

  async function atualizar(campo: Record<string, unknown>) {
    setSalvando(true); setErro(null); setAviso(null);
    try {
      const res = await fetch(`/api/galerias/${galeria.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(campo) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar as configurações.");
      const keys: Record<string, keyof Galeria> = { template: "template", isPublished: "is_published", allowFavorites: "allow_favorites", allowDownloads: "allow_downloads", watermarkPreviews: "watermark_previews", realtimeMode: "realtime_mode" };
      setSettings((previous) => {
        const next = { ...previous };
        for (const [key, value] of Object.entries(campo)) if (keys[key]) Object.assign(next, { [keys[key]]: value });
        if ("password" in campo) next.password_hash = campo.password ? "definida" : null;
        return next;
      });
      setAviso(campo.template ? "Modelo salvo. A galeria pública já usa este layout." : "Configuração salva.");
      router.refresh();
    } catch (error) { setErro(error instanceof Error ? error.message : "Falha de conexão. Tente novamente."); }
    finally { setSalvando(false); }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Configurações</h2>
      <fieldset disabled={salvando}>
        <legend className="font-medium">Modelo visual da galeria</legend>
        <p className="mb-4 mt-1 text-sm text-neutral-500">Passe o mouse ou escolha um modelo para visualizar. Depois confirme sua escolha.</p>
        <div className="grid gap-3 sm:grid-cols-3" onMouseLeave={() => setHovered(null)}>
          {TEMPLATES.map((t) => <label key={t.value} onMouseEnter={() => setHovered(t.value)} className={`cursor-pointer rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-ink ${draft === t.value ? "border-ink bg-neutral-50 ring-1 ring-ink" : "border-neutral-200 hover:border-neutral-400"}`}>
            <div className="mb-2 flex items-center gap-2"><input type="radio" name="gallery-template" value={t.value} checked={draft === t.value} onChange={() => { setDraft(t.value); setHovered(null); setAviso(null); }} onFocus={() => setHovered(t.value)} onBlur={() => setHovered(null)} /><span className="text-sm font-semibold">{t.label}</span>{settings.template === t.value && <span className="ml-auto text-xs text-neutral-500">Atual</span>}</div>
            <MiniLayout template={t.value} photos={photos} /><p className="mt-2 text-xs leading-relaxed text-neutral-500">{t.descricao}</p>
          </label>)}
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
          <div className="flex flex-wrap justify-between gap-1 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs"><p className="font-medium">Prévia · {TEMPLATES.find((t) => t.value === preview)?.label}</p><p className="text-neutral-500">{previewPhotos.length ? "Com as fotos desta galeria" : "Exemplo ilustrativo · envie fotos para ver sua galeria"}</p></div>
          <div aria-label={`Prévia do modelo ${TEMPLATES.find((t) => t.value === preview)?.label}`} className="max-h-80 overflow-y-auto p-3 sm:p-5">
            <div className={LAYOUT_GRID[preview]}>{photos.map((src, i) => <div key={`${src}-${i}`} className={`overflow-hidden rounded-lg bg-neutral-100 ${LAYOUT_ITEM[preview]}`}><img src={src} alt={`Foto ${i + 1} na prévia`} loading="lazy" className={preview === "grid" ? "h-full w-full object-cover" : "h-auto w-full object-cover"} /></div>)}</div>
          </div>
        </div>
        <button type="button" onClick={() => void atualizar({ template: draft })} disabled={salvando || draft === settings.template} className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-50">{salvando ? "Salvando…" : draft === settings.template ? "Modelo atual" : `Usar modelo ${TEMPLATES.find((t) => t.value === draft)?.label}`}</button>
      </fieldset>
      <div className="mt-2 space-y-4 border-t border-neutral-200 pt-5">
        <Toggle label="Publicar no portfólio público" checked={settings.is_published} disabled={salvando} onChange={(v) => void atualizar({ isPublished: v })} />
        <Toggle label="Evento em tempo real (fotos aparecem ao vivo pro cliente, sem precisar recarregar a página)" checked={settings.realtime_mode} disabled={salvando} onChange={(v) => void atualizar({ realtimeMode: v })} />
        <Toggle label="Cliente pode favoritar/aprovar fotos" checked={settings.allow_favorites} disabled={salvando} onChange={(v) => void atualizar({ allowFavorites: v })} />
        <Toggle label="Permitir download gratuito (sem cobrar nada)" checked={settings.allow_downloads} disabled={salvando} onChange={(v) => void atualizar({ allowDownloads: v })} />
        <p className="-mt-2 pl-0 text-xs text-neutral-500">Desativado = cobrado. Defina os preços (por foto ou pacote completo) na seção &quot;Cobrança de downloads&quot; abaixo.</p>
        <Toggle label="Marca d'água nas prévias" checked={settings.watermark_previews} disabled={salvando} onChange={(v) => void atualizar({ watermarkPreviews: v })} />
        <p className="-mt-2 pl-0 text-xs text-neutral-500">Configure sua logo e a posição dela em <a href="/painel/configuracoes" className="underline">Meu perfil</a>.</p>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="text-sm">Senha da galeria<input type="password" placeholder={settings.password_hash ? "Digite para trocar a senha" : "Sem senha"} value={senha} onChange={(e) => setSenha(e.target.value)} className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2" /></label>
        <button type="button" disabled={salvando} onClick={() => void atualizar({ password: senha || null })} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100">Salvar senha</button>
        {settings.password_hash && <button type="button" disabled={salvando} onClick={() => void atualizar({ password: null })} className="px-2 py-2 text-sm text-neutral-500 underline">Remover senha</button>}
      </div>
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      {aviso && <p role="status" className="text-sm text-green-700">{aviso}</p>}
    </section>
  );
}
function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center justify-between gap-4 text-sm">{label}<input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 shrink-0" /></label>;
}
