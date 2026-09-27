import type { Metadata } from "next";
import Link from "next/link";
import { ContactChange } from "@/components/account/ContactChange";
import { ProfileForm } from "@/components/account/ProfileForm";
import { Section } from "@/components/account/bits";
import { Icon } from "@/components/icons";
import { CreditPill } from "@/components/shell/CreditPill";
import { MotionToggle } from "@/components/shell/MotionToggle";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { DevDeliveryNotice } from "@/components/ui/notice";
import { requirePageUser } from "@/lib/auth/context";
import { publicAccount } from "@/lib/auth/service";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { user } = await requirePageUser();
  const account = publicAccount(user);
  const memberSince = new Date(account.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const initial = (account.displayName.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="sr-only">Your profile</h1>

      {/* Player card header */}
      <section aria-label="Player card" className="panel grain relative overflow-hidden p-5 sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-lilac-400/30 to-lagoon-400/0 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <span
            aria-hidden="true"
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-lagoon-300 via-lilac-400 to-coral-400 font-display text-3xl font-bold text-night-950 shadow-lift"
          >
            {initial}
          </span>
          <div className="min-w-0">
            <p className="eyebrow">Explorer</p>
            <p className="truncate font-display text-2xl font-bold text-ink">{account.displayName}</p>
            <p className="truncate text-sm text-muted">
              {account.publicHandle ? `@${account.publicHandle}` : "No public handle yet"} · Member since {memberSince}
            </p>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <CreditPill balance={account.demoCredit} />
          <span className="text-xs text-faint">Demo credit is free and has no monetary value.</span>
        </div>
      </section>

      <Section id="profile-public" eyebrow="How others see you" title="Public profile" icon={<Icon.User className="h-5 w-5" />}>
        <ProfileForm displayName={account.displayName} publicHandle={account.publicHandle} ownerIsPublic={account.ownerIsPublic} />
      </Section>

      <Section
        id="profile-contact"
        eyebrow="Private — only you see these"
        title="Email & phone"
        icon={<Icon.Globe className="h-5 w-5" />}
        description="Changing either needs your password and a code sent to the new address. Your old one stays active until the new one is confirmed."
      >
        <div className="space-y-3">
          <DevDeliveryNotice />
          <ContactChange channel="email" current={account.email} confirmed={account.emailConfirmed} />
          <ContactChange channel="phone" current={account.phone} confirmed={account.phoneConfirmed} />
          {!account.emailConfirmed || !account.phoneConfirmed ? (
            <p className="text-sm text-muted">
              Waiting on a confirmation code?{" "}
              <Link href="/confirm" className="font-bold text-lagoon-300 underline-offset-4 hover:underline">
                Confirm your details
              </Link>
            </p>
          ) : null}
        </div>
      </Section>

      <Link
        href="/security"
        className="panel flex items-center gap-4 p-5 transition hover:bg-night-800/80 sm:p-6"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/5 text-sun-300">
          <Icon.Shield className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="eyebrow block">Lock it down</span>
          <span className="block font-display text-xl font-semibold text-ink">Security</span>
          <span className="block text-sm text-muted">Password, signed-in devices and two-step verification.</span>
        </span>
        <Icon.Arrow className="h-5 w-5 shrink-0 text-muted" />
      </Link>

      <Section
        id="profile-comfort"
        eyebrow="Make it yours"
        title="Comfort"
        icon={<Icon.Sparkle className="h-5 w-5" />}
        description="Calm motion tones down bouncing, floating and flipping on this device. We also follow your system's reduced-motion setting."
      >
        <MotionToggle className="border border-white/15" />
      </Section>

      <div className="flex justify-center pb-4">
        <SignOutButton />
      </div>
    </div>
  );
}
