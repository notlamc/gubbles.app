"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client/api";

export interface SessionRow {
  id: string;
  deviceHint: string;
  lastUsedAt: string;
  lastUsedLabel: string;
  createdLabel: string;
  current: boolean;
}

export function SessionsList({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const others = sessions.filter((s) => !s.current).length;

  async function revoke(s: SessionRow) {
    setBusy(s.id);
    setError(undefined);
    setStatus(undefined);
    const res = await api<{ ok: boolean }>(`/security/sessions/${encodeURIComponent(s.id)}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok || res.error.code === "NOT_FOUND") {
      setStatus(`${s.deviceHint} has been signed out.`);
      router.refresh();
      return;
    }
    setError(res.error.message);
  }

  async function revokeOthers() {
    setBusy("others");
    setError(undefined);
    setStatus(undefined);
    const res = await api<{ revoked: number }>("/security/sessions/revoke-others", { method: "POST" });
    setBusy(null);
    if (res.ok) {
      const n = res.data.revoked;
      setStatus(n === 0 ? "No other devices were signed in." : `Signed out ${n} other ${n === 1 ? "device" : "devices"}. Poof!`);
      router.refresh();
      return;
    }
    setError(res.error.message);
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {sessions.map((s) => (
          <li
            key={s.id}
            className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${s.current ? "border-mint-400/30 bg-mint-400/5" : "border-white/10 bg-night-950/40"}`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-lagoon-300">
              <Icon.Globe className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
                {s.deviceHint}
                {s.current ? (
                  <span className="inline-flex items-center gap-1 rounded-pill border border-mint-400/40 bg-mint-400/10 px-2 py-0.5 text-xs font-bold text-mint-300">
                    <Icon.Check className="h-3 w-3" /> This device
                  </span>
                ) : null}
              </p>
              <p className="text-sm text-muted">
                Last active <time dateTime={s.lastUsedAt}>{s.lastUsedLabel}</time> · signed in {s.createdLabel}
              </p>
            </div>
            {s.current ? null : (
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={busy === s.id}
                disabled={busy !== null && busy !== s.id}
                onClick={() => revoke(s)}
                aria-label={`Revoke ${s.deviceHint}, last active ${s.lastUsedLabel}`}
              >
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>

      <div aria-live="polite">{status ? <p className="text-sm font-bold text-mint-300">{status}</p> : null}</div>
      {error ? <Notice tone="error">{error}</Notice> : null}

      {others > 0 ? (
        <Button type="button" variant="secondary" loading={busy === "others"} disabled={busy !== null && busy !== "others"} onClick={revokeOthers}>
          <Icon.Logout className="h-4 w-4" /> Sign out all other devices
        </Button>
      ) : (
        <p className="text-sm text-faint">Only this device is signed in. Cosy.</p>
      )}
    </div>
  );
}
