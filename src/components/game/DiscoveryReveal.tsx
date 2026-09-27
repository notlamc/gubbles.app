"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CardBack, GubbleCard } from "@/components/card/GubbleCard";
import { Icon } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { api, type ApiError } from "@/lib/client/api";
import type { MintedCardView } from "@/lib/cards/view";
import type { DiscoveryView } from "@/lib/discovery/service";

type Stage = "back" | "silhouette" | "revealed";

function prefersCalm() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "calm";
}

function useCountdown(iso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, new Date(iso).getTime() - now);
  return { ms, label: `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}` };
}

export function DiscoveryReveal({ discovery, animate }: { discovery: DiscoveryView; animate: boolean }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(animate ? "back" : "revealed");
  const [minting, setMinting] = useState(false);
  const [celebrate, setCelebrate] = useState<MintedCardView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const { ms, label } = useCountdown(discovery.expiresAt);
  const expired = ms <= 0;
  const { cost, balance, mintsToday, mintCap } = discovery.mint;
  const canAfford = balance >= cost;
  const capped = mintsToday >= mintCap;

  useEffect(() => {
    if (!animate) return;
    if (prefersCalm()) {
      // Reduced motion: skip straight to the revealed card.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStage("revealed");
      return;
    }
    const a = setTimeout(() => setStage("silhouette"), 650);
    const b = setTimeout(() => setStage("revealed"), 1700);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [animate]);

  useEffect(() => {
    if (!celebrate) return;
    const go = () => {
      router.push(`/cards/${celebrate.id}?minted=1`);
      router.refresh(); // re-render the shell so the demo-credit balance updates
    };
    if (prefersCalm()) return go();
    const t = setTimeout(go, 1800);
    return () => clearTimeout(t);
  }, [celebrate, router]);

  async function mint() {
    setMinting(true);
    setError(null);
    const res = await api<{ card: MintedCardView; alreadyMinted: boolean }>(`/discoveries/${discovery.id}/mint`, { method: "POST" });
    setMinting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCelebrate(res.data.card);
  }

  const card = discovery.card;
  const heading = discovery.mintedCardId ? "Already yours!" : discovery.reused ? "Welcome back!" : "Discovery!";
  const sub = discovery.mintedCardId
    ? "You minted this Gubble earlier today."
    : discovery.reused
      ? "You found this Gubble earlier today — same code, same day, same Gubble."
      : `A ${card.rarity.name.toLowerCase()} ${card.family.name} has been found!`;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="text-center">
        <h1 className="font-display text-5xl font-bold tracking-tight text-ink drop-shadow-[0_4px_0_rgb(0_0_0/0.35)] sm:text-6xl">{heading}</h1>
        <p className="mt-2 text-sm font-bold uppercase tracking-[0.2em] text-lagoon-300" aria-live="polite">
          {stage === "revealed" ? sub : "Something is stirring…"}
        </p>
      </header>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_1fr]">
        {/* Card stage */}
        <div className="relative mx-auto w-full max-w-[340px]">
          {stage === "back" ? (
            <div className="animate-wiggle">
              <CardBack label="Card about to be revealed" />
            </div>
          ) : (
            <div className={stage === "revealed" && animate ? "animate-flip-reveal" : ""}>
              <GubbleCard
                face={card}
                size="reveal"
                artClassName={stage === "silhouette" ? "brightness-0 transition-[filter] duration-700" : "transition-[filter] duration-700"}
              />
            </div>
          )}
          {stage !== "revealed" ? (
            <button type="button" onClick={() => setStage("revealed")} className="absolute -bottom-10 left-1/2 -translate-x-1/2 rounded-pill px-3 py-1 text-sm font-bold text-muted hover:text-ink">
              Skip animation
            </button>
          ) : null}
          {celebrate ? <Celebration name={card.name} onSkip={() => router.push(`/cards/${celebrate.id}?minted=1`)} /> : null}
        </div>

        {/* Details + mint */}
        <div className={`space-y-4 ${stage === "revealed" ? "animate-fade-up" : "invisible"}`}>
          <div className="panel space-y-3 p-5">
            <h2 className="font-display text-xl font-bold">About this find</h2>
            <dl className="grid gap-2 text-sm">
              <div className="flex items-start gap-2">
                <Icon.Pin className="mt-0.5 h-4 w-4 shrink-0 text-coral-400" />
                <div>
                  <dt className="sr-only">Approximate location</dt>
                  <dd>Found near <span className="font-bold">{discovery.approxLocation}</span> <span className="text-faint">(unverified browser location)</span></dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Icon.Sparkle className="mt-0.5 h-4 w-4 shrink-0 text-lilac-300" />
                <div>
                  <dt className="sr-only">Day</dt>
                  <dd>Discovered on <span className="font-bold">{discovery.utcDay}</span> (UTC day)</dd>
                </div>
              </div>
            </dl>
            <p className="text-xs text-faint">
              The code decides the family. The day and neighbourhood shape its element, look and rarity. You add a tiny personal signature (#{card.signature}).
            </p>
            {discovery.locationLocked ? (
              <Notice tone="info" title="Today's result is locked in">
                You scanned this code from a different area than your first scan today. Each code gives you one Gubble per UTC day, fixed at your first scan.
              </Notice>
            ) : null}
          </div>

          {discovery.mintedCardId ? (
            <div className="panel p-5">
              <ButtonLink href={`/cards/${discovery.mintedCardId}`} size="lg" className="w-full">
                View your card <Icon.Arrow className="h-5 w-5" />
              </ButtonLink>
            </div>
          ) : (
            <div className="panel space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold">Keep this Gubble?</h2>
                  <p className="text-sm text-muted">
                    Minting costs <strong className="text-sun-300">{cost} demo credit</strong>. You have <strong className="text-ink">{balance}</strong>.
                  </p>
                </div>
                <span className="rounded-pill bg-night-950/60 px-3 py-1 text-xs font-bold text-muted" title="Mints used today">
                  {mintsToday}/{mintCap} today
                </span>
              </div>
              {expired ? (
                <Notice tone="warning" title="This preview has expired">
                  Scan the same code again today to reopen it — it&apos;ll be the very same Gubble.
                </Notice>
              ) : !canAfford ? (
                <Notice tone="warning" title="Not enough demo credit">Demo credit can&apos;t be bought — it&apos;s just for trying Gubbles out.</Notice>
              ) : capped ? (
                <Notice tone="warning" title="Daily mint limit reached">Come back after midnight UTC to mint more.</Notice>
              ) : null}
              {error ? <Notice tone="error" title={error.message} /> : null}
              <Button size="lg" className="w-full" onClick={mint} loading={minting} disabled={expired || !canAfford || capped || Boolean(celebrate)}>
                <Icon.Coin className="h-5 w-5" /> Mint for {cost} demo credit
              </Button>
              <p className="text-center text-xs text-faint">
                {expired ? "Preview expired." : <>Preview held for <span className="font-bold tabular-nums">{label}</span>. The result never changes today.</>}
              </p>
              <Link href="/scan" className="block rounded-pill border border-white/10 py-3 text-center font-display font-semibold text-muted hover:bg-white/5 hover:text-ink">
                Skip — keep exploring
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Celebration({ name, onSkip }: { name: string; onSkip: () => void }) {
  return (
    <div role="status" className="absolute inset-0 z-30 grid place-items-center">
      <div className="absolute inset-0 rounded-card bg-night-950/40" aria-hidden="true" />
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className="absolute h-40 w-40 rounded-full border-4 border-sun-300 animate-burst"
          style={{ animationDelay: `${i * 180}ms` }}
        />
      ))}
      <div className="relative animate-pop-in rounded-3xl bg-gradient-to-b from-mint-300 to-mint-400 px-6 py-4 text-center text-night-950 shadow-lift">
        <p className="font-display text-3xl font-bold">Minted!</p>
        <p className="text-sm font-bold">{name} joined your collection</p>
      </div>
      <button type="button" onClick={onSkip} className="absolute bottom-3 rounded-pill bg-night-950/70 px-3 py-1 text-sm font-bold text-ink">
        Skip
      </button>
    </div>
  );
}
