import Link from "next/link";
import type { Metadata } from "next";
import { CardBack, GubbleCard } from "@/components/card/GubbleCard";
import { Icon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { requirePageUser } from "@/lib/auth/context";
import { listCollection } from "@/lib/cards/service";
import { cardFaceFromCandidate } from "@/lib/cards/view";
import { db } from "@/lib/db";
import { GAME } from "@/lib/game/constants";
import { dailyUsage } from "@/lib/game/daily";
import { endOfUtcDay, utcDay } from "@/lib/game/day";
import { parseCandidate } from "@/lib/game/types";

export const metadata: Metadata = { title: "Home" };

function untilReset(now: Date) {
  const ms = endOfUtcDay(now).getTime() - now.getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export default async function PlayPage() {
  const { user } = await requirePageUser();
  const now = new Date();
  const today = utcDay(now);
  const [usage, collection, openPreviews] = await Promise.all([
    dailyUsage(db, user.id, today),
    listCollection(user.id),
    db.discovery.findMany({
      where: { playerId: user.id, utcDay: today, card: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);
  const confirmed = Boolean(user.emailConfirmedAt && user.phoneConfirmedAt);
  const recent = collection.cards.slice(0, 4);

  return (
    <div className="space-y-8">
      <section className="animate-fade-up">
        <p className="eyebrow">Welcome back</p>
        <h1 className="mt-2 font-display text-4xl font-bold">Hey {user.displayName}!</h1>
        <p className="mt-1 text-muted">Something small and mischievous is hiding nearby. Go find it.</p>
      </section>

      {!confirmed ? (
        <Notice tone="warning" title="One quick step before you can discover">
          Confirm your email and phone so we know it&apos;s really you.{" "}
          <Link href="/confirm" className="font-bold underline">Confirm now</Link>
        </Notice>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel relative overflow-hidden p-6 sm:p-8">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-lagoon-400/20 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="w-32 shrink-0 self-center animate-float sm:w-36">
              <CardBack label="A Gubble waiting to be discovered" />
            </div>
            <div>
              <h2 className="font-display text-3xl font-bold">Scan a QR code</h2>
              <p className="mt-2 text-muted">
                Posters, menus, park signs — any QR code can hide a Gubble. Upload a photo and share your approximate location to see who&apos;s inside.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <ButtonLink href="/scan" size="lg">
                  <Icon.Scan className="h-5 w-5" /> Start a scan
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>

        <div className="panel p-6">
          <h2 className="font-display text-xl font-bold">Today</h2>
          <p className="text-xs text-faint">Resets at midnight UTC · in {untilReset(now)}</p>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-night-950/50 p-3">
              <dt className="text-xs font-bold text-muted">New finds</dt>
              <dd className="font-display text-2xl font-bold">{usage.discoveries}<span className="text-base text-faint">/{usage.discoveryCap}</span></dd>
            </div>
            <div className="rounded-2xl bg-night-950/50 p-3">
              <dt className="text-xs font-bold text-muted">Mints</dt>
              <dd className="font-display text-2xl font-bold">{usage.mints}<span className="text-base text-faint">/{usage.mintCap}</span></dd>
            </div>
            <div className="rounded-2xl bg-night-950/50 p-3">
              <dt className="text-xs font-bold text-muted">Demo credit</dt>
              <dd className="font-display text-2xl font-bold text-sun-300">{user.creditBalance}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-faint">
            Minting costs {GAME.MINT_COST} demo credit. Demo credit is free and has no monetary value. Re-scanning today&apos;s codes is always free.
          </p>
        </div>
      </section>

      {openPreviews.length ? (
        <section aria-labelledby="open-title">
          <h2 id="open-title" className="font-display text-2xl font-bold">Waiting to be minted</h2>
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {openPreviews.map((d) => (
              <li key={d.id}>
                <Link href={`/discoveries/${d.id}`} className="block rounded-[1.1rem] transition hover:-translate-y-1">
                  <GubbleCard face={cardFaceFromCandidate(parseCandidate(d.candidate))} size="thumb" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="recent-title">
        <div className="flex items-end justify-between">
          <h2 id="recent-title" className="font-display text-2xl font-bold">Recently minted</h2>
          {collection.total ? <Link href="/collection" className="text-sm font-bold text-lagoon-300 hover:underline">See all {collection.total}</Link> : null}
        </div>
        {recent.length ? (
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {recent.map((c) => (
              <li key={c.id}>
                <Link href={`/cards/${c.id}`} className="block rounded-[1.1rem] transition hover:-translate-y-1">
                  <GubbleCard face={c} minted={c} size="thumb" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="panel mt-4 flex flex-col items-center gap-3 p-8 text-center">
            <p className="font-display text-xl font-bold">Your collection is empty… for now.</p>
            <p className="max-w-md text-muted">Your first Gubble is out there somewhere. Scan any QR code to meet it.</p>
          </div>
        )}
      </section>
    </div>
  );
}
