import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { DriveConnection } from "./drive-connection";

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
    .select("display_name, slug, bio, instagram, whatsapp, avatar_url, pix_key, drive_email, drive_connected_at")
    .eq("id", user?.id)
    .single();

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-xl font-semibold">Meu perfil</h1>
      {fotografo && <ProfileForm fotografo={fotografo} />}

      <h2 className="mb-3 mt-10 text-lg font-semibold">Armazenamento</h2>
      <DriveConnection driveEmail={fotografo?.drive_email ?? null} status={searchParams.drive} />
    </div>
  );
}
