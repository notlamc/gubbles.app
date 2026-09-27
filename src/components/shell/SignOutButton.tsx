"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { Icon } from "@/components/icons";

export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await api("/auth/signout", { method: "POST" });
        router.replace("/signin?signedOut=1");
        router.refresh();
      }}
      className={`inline-flex items-center gap-2 rounded-pill px-3 py-2 text-sm font-bold text-muted hover:bg-white/5 hover:text-ink disabled:opacity-50 ${className}`}
    >
      <Icon.Logout className="h-4 w-4" /> Sign out
    </button>
  );
}
