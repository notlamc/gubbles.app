import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GubbleCard } from "@/components/card/GubbleCard";
import { ArtStatusPanel } from "@/components/game/ArtStatusPanel";
import { CopyButton } from "@/components/game/CopyButton";
import { FullscreenCard } from "@/components/game/FullscreenCard";
import { Icon, StatGlyph, TraitGlyph } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { isAppError } from "@/lib/api/errors";
import { requirePageUser } from "@/lib/auth/context";
import { verificationQrDataUri } from "@/lib/cards/qr";
import { getOwnedCard } from "@/lib/cards/service";
import { STAT_LABELS } from "@/lib/cards/view";
import { STAT_BUDGET } from "@/lib/game/catalogue";

export const metadata: Metadata = { title: "Card" };

export default async function CardDetailPage(props: PageProps<"/cards/[id]">) {
  const { user } = await requirePageUser();
  const { id } = await props.params;
  const sp = await props.searchParams;
  let detail;
  try {
    detail = await getOwnedCard(user.id, id);
  } catch (err) {
    if (isAppError(err) && err.code === "NOT_FOUND") notFound();
    throw err;
  }
  const { card, provenance } = detail;
  const qr = await verificationQrDataUri(card.verification.url);
  const shiny = ["rare", "epic", "mythic"].includes(card.rarity.id);
  const traitCost = card.traits.reduce((s, t) => s + t.cost, 0);

  return (
    <div className="space-y-6">
      <Link href="/collection" className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-ink">
        <Icon.Back className="h-4 w-4" /> Collection
      </Link>

      {sp.minted === "1" ? (
        <div role="status" className="animate-pop-in rounded-panel border border-mint-400/40 bg-mint-400/10 px-5 py-4">
          <p className="font-display text-2xl font-bold text-mint-300">Welcome to the collection, {card.name}!</p>
          <p className="text-sm text-muted">Minted and saved. Its illustration is being painted right now.</p>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
        <div className="space-y-4">
          <div className="mx-auto w-full max-w-[380px]">
            <GubbleCard face={card} minted={card} size="detail" />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <FullscreenCard shiny={shiny} label={`${card.name} full-screen view`}>
              <GubbleCard face={card} minted={card} size="detail" className="!max-w-none" />
            </FullscreenCard>
            <Link href={`/verify/cards/${card.verification.publicId}`} className={buttonClass("secondary")}>
              <Icon.Shield className="h-4 w-4" /> View verification
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <ArtStatusPanel cardId={card.id} initial={card.art} />

          <section aria-labelledby="verify-title" className="panel p-5">
            <h2 id="verify-title" className="font-display text-lg font-bold">Verification QR</h2>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={`QR code linking to the public verification page for card ${card.cardNumber}`} width={220} height={220} className="h-[220px] w-[220px] shrink-0 rounded-2xl bg-white p-1" />
              <div className="min-w-0 space-y-2 text-sm">
                <p className="text-muted">Anyone can scan this to see that the card exists and who owns it <em>right now</em>. Copying the QR gives nobody control of your card.</p>
                <p>
                  <span className="text-faint">Card ID</span>
                  <br />
                  <code className="break-all font-bold">{card.id}</code>
                </p>
                <p>
                  <span className="text-faint">Verification link</span>
                  <br />
                  <Link href={`/verify/cards/${card.verification.publicId}`} className="break-all font-bold text-lagoon-300 underline">
                    {card.verification.url}
                  </Link>
                </p>
                <CopyButton text={card.verification.url} label="Copy verification link" />
              </div>
            </div>
          </section>

          <section aria-labelledby="stats-title" className="panel p-5">
            <h2 id="stats-title" className="font-display text-lg font-bold">Stats &amp; traits</h2>
            <p className="mt-1 text-sm text-muted">
              Every Gubble shares the same {STAT_BUDGET}-point stat budget. As a <strong className="text-ink">{card.role.name}</strong>, {card.name} {card.role.blurb.charAt(0).toLowerCase() + card.role.blurb.slice(1)} Its traits spend {traitCost} points, leaving {card.stats.power + card.stats.guard + card.stats.speed}. Rarity changes the look, never the budget.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-3">
              {(["power", "guard", "speed"] as const).map((k) => (
                <li key={k} className="rounded-2xl bg-night-950/50 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    <StatGlyph stat={k} className="h-4 w-4 text-lagoon-300" /> {STAT_LABELS[k].name} <span className="ml-auto font-display text-xl">{card.stats[k]}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">{STAT_LABELS[k].explain}</p>
                </li>
              ))}
            </ul>
            <ul className="mt-3 grid gap-2">
              {card.traits.map((t) => (
                <li key={t.id} className="flex gap-3 rounded-2xl bg-night-950/50 p-3 text-sm">
                  <TraitGlyph icon={t.icon} className="mt-0.5 h-5 w-5 shrink-0 text-lilac-300" />
                  <div>
                    <p className="font-bold">{t.name} <span className="text-xs font-semibold text-faint">· costs {t.cost} stat points</span></p>
                    <p className="text-muted">{t.description}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint">Battles and trading aren&apos;t live yet — traits describe how this Gubble behaves; their battle rules arrive in a future season.</p>
          </section>

          <section aria-labelledby="prov-title" className="panel p-5">
            <h2 id="prov-title" className="font-display text-lg font-bold">How it was discovered</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-faint">Discovered (UTC day)</dt><dd className="font-bold">{provenance.discoveryUtcDay}</dd></div>
              <div><dt className="text-faint">Minted</dt><dd className="font-bold">{new Date(card.mintedAt).toUTCString()}</dd></div>
              <div><dt className="text-faint">Approximate area <span className="text-xs">(only you see this)</span></dt><dd className="font-bold">{provenance.approxLocation}</dd></div>
              <div><dt className="text-faint">Ruleset</dt><dd className="font-bold">{provenance.rulesetId}</dd></div>
              <div><dt className="text-faint">Personal signature</dt><dd className="font-bold">#{card.signature}</dd></div>
              <div><dt className="text-faint">Seed fingerprint</dt><dd className="font-mono font-bold">{provenance.seedPrefix}…</dd></div>
            </dl>
            <p className="mt-3 text-xs text-faint">Location was a browser-reported claim and is not verified. The scanned code&apos;s contents are never stored.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
