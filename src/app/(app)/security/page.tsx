import type { Metadata } from "next";
import Link from "next/link";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { SessionsList, type SessionRow } from "@/components/account/SessionsList";
import { TwoStepSettings } from "@/components/account/TwoStepSettings";
import { Section } from "@/components/account/bits";
import { Icon } from "@/components/icons";
import { requirePageUser } from "@/lib/auth/context";
import { listSessions, securityOverview } from "@/lib/auth/service";

export const metadata: Metadata = { title: "Security" };

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "5 minutes ago", "yesterday", "just now" — computed at request time on the server. */
function relativeTime(iso: string, nowMs: number): string {
  const seconds = Math.round((new Date(iso).getTime() - nowMs) / 1000);
  if (Math.abs(seconds) < 60) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

function toRows(sessions: Awaited<ReturnType<typeof listSessions>>): SessionRow[] {
  const now = Date.now();
  return sessions.map((s) => ({
    id: s.id,
    deviceHint: s.deviceHint,
    lastUsedAt: s.lastUsedAt,
    lastUsedLabel: s.current ? "now" : relativeTime(s.lastUsedAt, now),
    createdLabel: relativeTime(s.createdAt, now),
    current: s.current,
  }));
}

export default async function SecurityPage() {
  const { user, session } = await requirePageUser();
  const [overview, sessions] = await Promise.all([securityOverview(user.id), listSessions(user.id, session.id)]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-2">
        <Link href="/profile" className="inline-flex items-center gap-1.5 rounded-pill px-2 py-1 text-sm font-bold text-muted hover:bg-white/5 hover:text-ink">
          <Icon.Back className="h-4 w-4" /> Profile
        </Link>
        <p className="eyebrow">Keep the Gubbles safe</p>
        <h1 className="text-3xl font-bold text-ink">Security</h1>
        <p className="text-muted">Your password, where you&apos;re signed in, and an extra lock for the door.</p>
      </div>

      <Section
        id="sec-password"
        eyebrow="Secret word"
        title="Change password"
        icon={<Icon.Key className="h-5 w-5" />}
        description="Changing your password signs out every other device. This one stays signed in."
      >
        <ChangePasswordForm />
      </Section>

      <Section
        id="sec-sessions"
        eyebrow="Where you're signed in"
        title="Active sessions"
        icon={<Icon.Globe className="h-5 w-5" />}
        description="Don't recognise one? Revoke it, then change your password."
      >
        <SessionsList sessions={toRows(sessions)} />
      </Section>

      <Section
        id="sec-2fa"
        eyebrow="Extra lock"
        title="Two-step verification"
        icon={<Icon.Shield className="h-5 w-5" />}
        description="Uses an authenticator app — no SMS."
      >
        <TwoStepSettings enabled={overview.totpEnabled} recoveryCodesRemaining={overview.recoveryCodesRemaining} />
      </Section>
    </div>
  );
}
