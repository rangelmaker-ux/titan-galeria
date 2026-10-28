"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SairButton() {
  const router = useRouter();
  const supabase = createClient();

  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.push("/");
        router.refresh();
      }}
      className="underline-offset-2 hover:underline"
    >
      Sair
    </button>
  );
}
