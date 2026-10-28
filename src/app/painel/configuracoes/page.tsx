import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function ConfiguracoesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: fotografo } = await supabase
    .from("photographers")
    .select("display_name, slug, bio, instagram, whatsapp")
    .eq("id", user?.id)
    .single();

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-xl font-semibold">Meu perfil</h1>
      {fotografo && <ProfileForm fotografo={fotografo} />}
    </div>
  );
}
