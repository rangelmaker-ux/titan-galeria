import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { DriveConnection } from "./drive-connection";
import { WatermarkForm } from "./watermark-form";
import { getPlan, getBillingOption } from "@/lib/plans";

const STATUS_LABEL: Record<string, string> = {
  inactive: "Sem assinatura ativa", trialing: "Em teste", active: "Ativa",
  past_due: "Pagamento em atraso", canceled: "Cancelada", unpaid: "Pagamento pendente",
};

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: { drive?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: fotografo } = await supabase
    .from("photographers")
    .select(
      "display_name, slug, bio, instagram, whatsapp, avatar_url, pix_key, drive_email, drive_connected_at, watermark_logo_url, watermark_pos_x, watermark_pos_y, watermark_scale, watermark_opacity, plan, billing_interval, subscription_status, plan_source"
    )
    .eq("id", user?.id)
    .single();

  const planoAtual = fotografo ? getPlan(fotografo.plan) : null;
  const cicloAtual = fotografo ? getBillingOption(fotografo.billing_interval) : null;
  const status = fotografo?.subscription_status || "inactive";
  const acessoLiberado = fotografo?.plan_source === "admin" || fotografo?.plan_source === "manual";

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-xl font-semibold">Meu perfil</h1>
      {fotografo && <ProfileForm fotografo={fotografo} />}

      <h2 className="mb-3 mt-10 text-lg font-semibold">Plano e assinatura</h2>
      <Link
        href="/painel/assinatura"
        className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-4 text-sm hover:border-neutral-400"
      >
        <div>
          <p className="font-medium">{planoAtual?.nome ?? "—"}{!acessoLiberado && cicloAtual && <span className="font-normal text-neutral-500"> · {cicloAtual.cicloLabel}</span>}</p>
          <p className="mt-1 text-xs text-neutral-500">{acessoLiberado ? "Acesso liberado" : STATUS_LABEL[status] || status}</p>
        </div>
        <span className="shrink-0 text-neutral-400">Gerenciar →</span>
      </Link>

      <h2 className="mb-3 mt-10 text-lg font-semibold">Marca d&apos;água</h2>
      <WatermarkForm
        logoUrl={fotografo?.watermark_logo_url ?? null}
        posX={fotografo?.watermark_pos_x ?? 50}
        posY={fotografo?.watermark_pos_y ?? 50}
        scale={fotografo?.watermark_scale ?? 20}
        opacity={fotografo?.watermark_opacity ?? 70}
      />

      <h2 className="mb-3 mt-10 text-lg font-semibold">Armazenamento</h2>
      <DriveConnection driveEmail={fotografo?.drive_email ?? null} status={searchParams.drive} />
    </div>
  );
}
