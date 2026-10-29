import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { DriveConnection } from "./drive-connection";
import { WatermarkForm } from "./watermark-form";

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
      "display_name, slug, bio, instagram, whatsapp, avatar_url, pix_key, drive_email, drive_connected_at, watermark_logo_url, watermark_pos_x, watermark_pos_y, watermark_scale, watermark_opacity"
    )
    .eq("id", user?.id)
    .single();

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-xl font-semibold">Meu perfil</h1>
      {fotografo && <ProfileForm fotografo={fotografo} />}

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
