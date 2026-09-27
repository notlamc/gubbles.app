"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client/api";
import { CodeField, StatusBadge, digitsOnly, useCooldown } from "./bits";

type Channel = "email" | "phone";

export function ConfirmChannels({
  email,
  phone,
  emailConfirmed,
  phoneConfirmed,
}: {
  email: string;
  phone: string;
  emailConfirmed: boolean;
  phoneConfirmed: boolean;
}) {
  if (emailConfirmed && phoneConfirmed) {
    return (
      <div className="animate-pop-in space-y-4 rounded-card border border-mint-400/30 bg-mint-400/10 p-6 text-center" role="status">
        <span className="relative mx-auto grid h-16 w-16 place-items-center">
          <span aria-hidden="true" className="absolute inset-0 animate-burst rounded-full bg-mint-400/40" />
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-b from-mint-300 to-mint-400 text-night-950">
            <Icon.Check className="h-8 w-8" />
          </span>
        </span>
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-ink">You&apos;re all set!</h2>
          <p className="text-muted">Email and phone confirmed. The Gubbles are already whispering about you.</p>
        </div>
        <ButtonLink href="/play" size="lg" className="w-full">
          Start discovering <Icon.Arrow className="h-5 w-5" />
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ChannelCard channel="email" label="Email" value={email} confirmed={emailConfirmed} icon={<MailGlyph />} />
      <ChannelCard channel="phone" label="Phone" value={phone} confirmed={phoneConfirmed} icon={<PhoneGlyph />} />
    </div>
  );
}

function ChannelCard({
  channel,
  label,
  value,
  confirmed,
  icon,
}: {
  channel: Channel;
  label: string;
  value: string;
  confirmed: boolean;
  icon: ReactNode;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [busy, setBusy] = useState<"confirm" | "send" | null>(null);
  const cooldown = useCooldown();
  const titleId = `confirm-${channel}-title`;

  async function onConfirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setStatus(undefined);
    if (code.length !== 6) return setError("Codes are 6 digits.");
    setBusy("confirm");
    const res = await api<{ confirmed: Channel }>("/account/confirm", { method: "POST", json: { channel, code } });
    setBusy(null);
    if (res.ok) {
      setCode("");
      setStatus(`${label} confirmed!`);
      router.refresh();
      return;
    }
    setError(res.error.message);
  }

  async function onResend() {
    setError(undefined);
    setStatus(undefined);
    setBusy("send");
    const res = await api<{ sent: true; expiresAt: string; resendAvailableAt: string } | { alreadyConfirmed: true }>(
      "/account/confirm/send",
      { method: "POST", json: { channel } },
    );
    setBusy(null);
    if (res.ok) {
      if ("alreadyConfirmed" in res.data) {
        router.refresh();
        return;
      }
      setStatus(`Fresh code sent to ${value}. Older codes no longer work.`);
      cooldown.startUntil(new Date(res.data.resendAvailableAt).getTime());
      return;
    }
    const retry = res.error.details?.retryAfterSeconds;
    if (res.error.code === "RESEND_COOLDOWN" && typeof retry === "number") {
      cooldown.startFor(retry);
      setStatus("A code was sent very recently — give it a moment to arrive.");
      return;
    }
    setError(res.error.message);
  }

  return (
    <section
      aria-labelledby={titleId}
      className={`rounded-card border p-4 sm:p-5 ${confirmed ? "border-mint-400/30 bg-mint-400/5" : "border-white/10 bg-night-950/40"}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/5 text-lagoon-300">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {label}
            </h2>
            <StatusBadge ok={confirmed} okLabel="Confirmed ✓" pendingLabel="Needs a code" />
          </div>
          <p className="break-all text-sm text-muted">{value}</p>
        </div>
      </div>

      {confirmed ? null : (
        <div className="mt-4 space-y-3">
          <form onSubmit={onConfirm} noValidate className="space-y-3">
            <CodeField
              label={`Code sent to your ${label.toLowerCase()}`}
              name={`${channel}-code`}
              value={code}
              onChange={(e) => {
                setCode(digitsOnly(e.target.value));
                setError(undefined);
              }}
              error={error}
            />
            <Button type="submit" className="w-full" loading={busy === "confirm"} disabled={busy === "send"}>
              Confirm {label.toLowerCase()}
            </Button>
          </form>
          <div className="flex flex-col items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResend}
              loading={busy === "send"}
              disabled={cooldown.active || busy === "confirm"}
            >
              <Icon.Refresh className="h-4 w-4" />
              {cooldown.active ? `Send a new code in ${cooldown.remaining}s` : "Send a new code"}
            </Button>
          </div>
        </div>
      )}

      <div aria-live="polite" className="mt-2 text-center text-sm">
        {status ? <p className={confirmed ? "font-bold text-mint-300" : "text-muted"}>{status}</p> : null}
      </div>
    </section>
  );
}


function MailGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function PhoneGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  );
}
