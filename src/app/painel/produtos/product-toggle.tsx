"use client";

import { useRouter } from "next/navigation";

export function ProductToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();

  async function alternar() {
    await fetch("/api/produtos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !active }),
    });
    router.refresh();
  }

  return (
    <button
      onClick={alternar}
      className={`rounded-full px-3 py-1 text-xs ${
        active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
      }`}
    >
      {active ? "ativo" : "inativo"}
    </button>
  );
}
