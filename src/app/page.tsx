import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { CardBack, GubbleCard } from "@/components/card/GubbleCard";
import { Icon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { currentUser } from "@/lib/auth/context";
import { sampleFace } from "@/lib/cards/samples";
import { GAME } from "@/lib/game/constants";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const user = await currentUser();
  const cards = [sampleFace("flurri", "uncommon"), sampleFace("brimmo", "epic"), sampleFace("mosslet", "rare")];
  const cta = user ? { href: "/play", label: "Continue playing" } : { href: "/signup", label: "Start discovering" };

  return (
    <div className="overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
        <Link href="/" aria-label="Gubbles home" className="rounded-xl">
          <Logo size="md" className="sm:hidden" />
          <Logo size="lg" className="max-sm:hidden" />
        </Link>
        <nav aria-label="Site" className="flex items-center gap-2 text-sm font-bold">
          <a href="#how" className="hidden rounded-pill px-3 py-2 text-muted hover:text-ink md:inline">How it works</a>
          {user ? null : (
            <Link href="/signin" className="whitespace-nowrap rounded-pill px-3 py-2 text-muted hover:text-ink">Sign in</Link>
          )}
          <ButtonLink href={cta.href} variant="coral" size="sm">{cta.label}</ButtonLink>
        </nav>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-6 lg:grid-cols-[1.05fr_1fr] lg:pt-12">
          <div className="animate-fade-up">
            <p className="eyebrow">Real places. Mischievous creatures.</p>
            <h1 className="mt-4 font-display text-5xl font-bold leading-[0.95] sm:text-6xl lg:text-7xl">
              The world is <br className="hidden sm:block" />
              full of{" "}
              <span className="bg-gradient-to-r from-coral-400 via-coral-500 to-sun-400 bg-clip-text text-transparent">Gubbles</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted">
              Little creatures hide behind the QR codes on posters, menus and park signs. Snap one, share where you are,
              and see who pops out. Keep your favourites as collectible trading cards.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href={cta.href} variant="coral" size="lg">
                {cta.label} <Icon.Arrow className="h-5 w-5" />
              </ButtonLink>
              <a href="#how" className="rounded-pill px-4 py-3 font-bold text-muted hover:text-ink">See how it works</a>
            </div>
            <p className="mt-5 text-sm text-faint">
              Every new player gets {GAME.STARTING_DEMO_CREDIT} free demo credits — just for play, never for sale, no monetary value.
            </p>
          </div>

          <div className="relative mx-auto h-[560px] w-full max-w-[520px] sm:h-[700px]" aria-label="Example Gubble cards" role="group">
            <div className="absolute left-0 top-10 w-[62%] -rotate-[9deg] opacity-95 max-sm:hidden">
              <GubbleCard face={cards[0]!} size="reveal" />
            </div>
            <div className="absolute right-0 top-14 w-[62%] rotate-[9deg] opacity-95 max-sm:hidden">
              <GubbleCard face={cards[2]!} size="reveal" />
            </div>
            <div className="absolute left-1/2 top-0 w-[86%] -translate-x-1/2 animate-float sm:w-[66%]">
              <GubbleCard face={cards[1]!} size="reveal" />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="border-y border-white/5 bg-night-900/60">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <p className="eyebrow">From your world to the Gubbles universe</p>
            <h2 id="how-title" className="mt-3 font-display text-3xl font-bold sm:text-4xl">Scan. Discover. Mint.</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  n: 1,
                  title: "Scan",
                  body: "Photograph any QR code you find out in the world. We read it on our server and never open the link inside.",
                  art: (
                    <div className="relative mx-auto grid h-36 w-28 place-items-center rounded-3xl border-2 border-lagoon-400/60 bg-night-950">
                      <Icon.Scan className="h-14 w-14 text-lagoon-300" />
                      <div className="absolute inset-x-3 top-3 h-1 rounded bg-lagoon-300/80 animate-scan" />
                    </div>
                  ),
                },
                {
                  n: 2,
                  title: "Discover",
                  body: "Share your approximate location. The code, the day and the neighbourhood decide which Gubble appears.",
                  art: <CardBack className="mx-auto !w-28" />,
                },
                {
                  n: 3,
                  title: "Mint",
                  body: "Spend a demo credit to keep it. Your card gets its own illustration and a QR anyone can scan to verify it.",
                  art: (
                    <div className="relative mx-auto w-28 rotate-3">
                      <GubbleCard face={cards[0]!} size="thumb" />
                      <span className="absolute -bottom-3 -right-6 rotate-[-8deg] rounded-xl bg-mint-400 px-2.5 py-1 font-display text-sm font-bold text-night-950 shadow-lift">MINTED ✓</span>
                    </div>
                  ),
                },
              ].map((s) => (
                <li key={s.n} className="panel p-6">
                  <div className="h-40">{s.art}</div>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-night-600 font-display text-lg font-bold" aria-hidden="true">{s.n}</span>
                    <h3 className="font-display text-2xl font-bold">{s.title}</h3>
                  </div>
                  <p className="mt-2 text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-14" aria-label="Highlights">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Icon.Globe, title: "Real-world exploration", body: "Every code hides a Gubble family. Where and when you look shapes the rest." },
              { icon: Icon.Cards, title: "Hand-crafted cards", body: "Six families, four elements, balanced stats — rarity is about looks, not raw power." },
              { icon: Icon.Shield, title: "Verifiable ownership", body: "Each minted card has a public page showing its current in-app owner, live." },
              { icon: Icon.Coin, title: "Demo credit only", body: "No payments, no cash-out, no blockchain. Just a free allowance to play with." },
            ].map((f) => (
              <li key={f.title} className="flex gap-3 rounded-panel border border-white/5 p-4">
                <f.icon className="h-7 w-7 shrink-0 text-lagoon-300" />
                <div>
                  <h3 className="font-display text-base font-bold uppercase tracking-wide">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-sm text-faint">
        <p>
          Gubbles is a proof of concept. Trading and battles aren&apos;t available yet. Locations are unverified browser claims.{" "}
          <Link href="/terms" className="underline hover:text-ink">Terms</Link>
        </p>
      </footer>
    </div>
  );
}
