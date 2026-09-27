import type { CSSProperties } from "react";
import { creatureSvgDataUri } from "@/lib/art/creature-svg";
import { STAT_LABELS, type CardFace, type MintedCardView } from "@/lib/cards/view";
import { ElementGlyph, RarityGem, StatGlyph, TraitGlyph } from "@/components/icons";
import { Spinner } from "@/components/ui/button";

/**
 * The one shared card renderer. Sizes:
 *  - "reveal": discovery preview (full information, slightly smaller)
 *  - "detail": owner detail / public verification
 *  - "thumb":  collection grid (art, name, element, rarity)
 * All text is real HTML; the art is an <img> (code-rendered SVG preview or the
 * generated creature illustration). Stats always carry text labels, never colour alone.
 */

export const ELEMENT_COLOR: Record<string, string> = {
  tide: "var(--color-tide)",
  gale: "var(--color-gale)",
  ember: "var(--color-ember)",
  grove: "var(--color-grove)",
};

export const ELEMENT_BG: Record<string, string> = {
  tide: "linear-gradient(170deg, #0f3a5c 0%, #0a1f3d 55%, #081530 100%)",
  gale: "linear-gradient(170deg, #2d2463 0%, #1a1745 55%, #0f0f30 100%)",
  ember: "linear-gradient(170deg, #5a2218 0%, #33131c 55%, #1a0c1c 100%)",
  grove: "linear-gradient(170deg, #1d4a2c 0%, #12301f 55%, #0b1d19 100%)",
};

export const RARITY_COLOR: Record<string, string> = {
  common: "var(--color-common)",
  uncommon: "var(--color-uncommon)",
  rare: "var(--color-rare)",
  epic: "var(--color-epic)",
  mythic: "var(--color-mythic)",
};

const RARITY_FRAME: Record<string, string> = {
  common: "linear-gradient(145deg, #b8f0cb, #5fb884 45%, #2f6f4a)",
  uncommon: "linear-gradient(145deg, #a6fff5, #3cc3b5 45%, #1d6d6a)",
  rare: "linear-gradient(145deg, #c9e2ff, #5aa9ff 45%, #2c4fb0)",
  epic: "linear-gradient(145deg, #f1d5ff, #c77dff 40%, #6b2fb3 75%, #f1d5ff)",
  mythic: "linear-gradient(145deg, #fff3c4, #ffd166 30%, #ff9a1f 55%, #ffe8a3 75%, #c77dff)",
};

type Size = "reveal" | "detail" | "thumb";

export interface GubbleCardProps {
  face: CardFace;
  size?: Size;
  minted?: Pick<MintedCardView, "cardNumber" | "mintedAt" | "art">;
  className?: string;
  /** Overrides the art <img> (e.g. to show a silhouette during reveal). */
  artClassName?: string;
}

function artSrc(face: CardFace, minted?: GubbleCardProps["minted"], thumb = false): string {
  if (minted?.art.status === "ART_READY") {
    const url = thumb ? minted.art.thumbUrl : minted.art.url;
    if (url) return url;
  }
  return creatureSvgDataUri(face.artSpec);
}

function artAlt(face: CardFace, minted?: GubbleCardProps["minted"]) {
  const kind = minted?.art.status === "ART_READY" ? "Illustration" : "Preview artwork";
  return `${kind} of ${face.name}, a ${face.variant.name.toLowerCase()} ${face.element.name} ${face.family.name}`;
}

function cardLabel(face: CardFace) {
  return `${face.name} — ${face.rarity.name} ${face.element.name} ${face.role.name} card. Power ${face.stats.power}, Guard ${face.stats.guard}, Speed ${face.stats.speed}.`;
}

export function GubbleCard({ face, size = "detail", minted, className = "", artClassName = "" }: GubbleCardProps) {
  const vars = {
    "--el": ELEMENT_COLOR[face.element.id],
    "--rar": RARITY_COLOR[face.rarity.id],
  } as CSSProperties;

  if (size === "thumb") return <Thumb face={face} minted={minted} className={className} vars={vars} />;

  const shiny = face.rarity.id === "rare" || face.rarity.id === "epic" || face.rarity.id === "mythic";
  const headline = STAT_LABELS[face.headline.stat];
  const compact = size === "reveal";

  return (
    <article
      aria-label={cardLabel(face)}
      style={{ ...vars, background: RARITY_FRAME[face.rarity.id] }}
      className={`relative w-full rounded-card p-[4px] shadow-lift ${compact ? "max-w-[340px]" : "max-w-[380px]"} ${className}`}
    >
      <div className="relative overflow-hidden rounded-[calc(var(--radius-card)-4px)]" style={{ background: ELEMENT_BG[face.element.id] }}>
        <div className="grain pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        {shiny ? <div className="foil pointer-events-none absolute inset-0 z-20 opacity-25" aria-hidden="true" /> : null}

        {/* Top bar: name, family/variant marker, rarity and headline stat */}
        <header className="relative z-10 flex items-start justify-between gap-2 px-3.5 pt-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-[1.65rem] font-bold leading-none text-ink drop-shadow-[0_2px_0_rgb(0_0_0/0.35)]">{face.name}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--rar)]">
              <RarityGem rarity={face.rarity.id} className="h-3.5 w-3.5" />
              <span>{face.rarity.name}</span>
              <span className="text-white/35" aria-hidden="true">•</span>
              <span className="whitespace-nowrap text-white/70">No.{String(face.family.number).padStart(3, "0")} {face.variant.name}</span>
            </p>
          </div>
          <div
            className="flex shrink-0 items-center gap-1 rounded-2xl border border-white/15 bg-night-950/55 px-2.5 py-1.5 text-ink"
            title={`${headline.name}: this ${face.role.name}'s headline stat`}
          >
            <StatGlyph stat={face.headline.stat} className="h-4 w-4 text-[var(--el)]" />
            <span className="font-display text-xl font-bold leading-none">{face.headline.value}</span>
            <span className="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted">{headline.name.slice(0, 3)}</span>
          </div>
        </header>

        {/* Illustration window */}
        <div className="relative z-10 mx-3 mt-2.5 overflow-hidden rounded-2xl border-2 border-[var(--rar)]/60 bg-night-950 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artSrc(face, minted)}
            alt={artAlt(face, minted)}
            width={512}
            height={512}
            className={`aspect-[5/4] w-full object-cover ${artClassName}`}
            draggable={false}
          />
          <span
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-pill border border-white/20 bg-night-950/70 px-2 py-1 text-xs font-bold text-[var(--el)] backdrop-blur"
            title={`Element: ${face.element.name}`}
          >
            <ElementGlyph element={face.element.id} className="h-4 w-4" />
            <span className="text-ink">{face.element.name}</span>
          </span>
          {minted && minted.art.status !== "ART_READY" ? (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-pill bg-night-950/80 px-2.5 py-1 text-xs font-bold text-sun-300 backdrop-blur">
              {minted.art.status === "ART_PENDING" ? (
                <>
                  <Spinner className="h-3.5 w-3.5" /> Generating artwork
                </>
              ) : (
                <>Artwork failed — preview shown</>
              )}
            </span>
          ) : null}
        </div>

        {/* Flavour + role */}
        <div className="relative z-10 px-3.5 pt-2.5 text-center">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-ink/85">{face.flavour}</p>
          <p className="mt-1 text-xs text-muted">
            <span className="font-bold text-[var(--el)]">{face.role.name}</span> · {face.role.blurb.split(".")[0]}.
          </p>
        </div>

        {/* Traits */}
        <ul className="relative z-10 mt-2.5 grid gap-1.5 px-3" aria-label="Traits">
          {face.traits.map((t) => (
            <li key={t.id} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-night-950/45 px-2.5 py-1.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--el)]/15 text-[var(--el)] ring-1 ring-[var(--el)]/40">
                <TraitGlyph icon={t.icon} className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-sm font-semibold leading-tight text-ink">{t.name}</span>
                <span className="block text-xs leading-snug text-muted">{t.description}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* Stats */}
        <dl className="relative z-10 mt-2 grid grid-cols-3 gap-1.5 px-3">
          {(["power", "guard", "speed"] as const).map((k) => (
            <div key={k} className={`rounded-xl border px-2 py-1.5 text-center ${k === face.headline.stat ? "border-[var(--el)]/60 bg-[var(--el)]/10" : "border-white/10 bg-night-950/45"}`}>
              <dt className="flex items-center justify-center gap-1 text-[0.65rem] font-extrabold uppercase tracking-wider text-muted">
                <StatGlyph stat={k} className="h-3.5 w-3.5 text-[var(--el)]" />
                {STAT_LABELS[k].name}
              </dt>
              <dd className="font-display text-2xl font-bold leading-tight text-ink">{face.stats[k]}</dd>
            </div>
          ))}
        </dl>

        {/* Provenance footer */}
        <footer className="relative z-10 mt-2 flex items-center justify-between gap-2 px-3.5 pb-2.5 pt-1 text-[0.62rem] font-semibold uppercase tracking-wider text-faint">
          <span>{minted ? minted.cardNumber : `${face.family.code}-${String(face.family.number).padStart(3, "0")} · Unminted`}</span>
          <span>Sig #{face.signature}</span>
          <span>{minted ? new Date(minted.mintedAt).toISOString().slice(0, 10) : face.rulesetId}</span>
        </footer>
      </div>
    </article>
  );
}

function Thumb({ face, minted, className, vars }: { face: CardFace; minted?: GubbleCardProps["minted"]; className: string; vars: CSSProperties }) {
  return (
    <article
      aria-label={`${face.name}, ${face.rarity.name} ${face.element.name}`}
      style={{ ...vars, background: RARITY_FRAME[face.rarity.id] }}
      className={`relative rounded-[1.1rem] p-[3px] shadow-lift ${className}`}
    >
      <div className="relative overflow-hidden rounded-[calc(1.1rem-3px)]" style={{ background: ELEMENT_BG[face.element.id] }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artSrc(face, minted, true)} alt={artAlt(face, minted)} width={320} height={320} loading="lazy" className="aspect-[4/5] w-full object-cover" draggable={false} />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-pill bg-night-950/75 px-2 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-[var(--rar)] backdrop-blur">
          <RarityGem rarity={face.rarity.id} className="h-3 w-3" />
          {face.rarity.name}
        </span>
        {minted && minted.art.status === "ART_PENDING" ? (
          <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-night-950/75 text-sun-300" title="Generating artwork">
            <Spinner className="h-3.5 w-3.5" />
            <span className="sr-only">Generating artwork</span>
          </span>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-night-950/95 via-night-950/70 to-transparent px-2.5 pb-2 pt-6">
          <span className="truncate font-display text-base font-bold text-ink">{face.name}</span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--el)]" title={`Element: ${face.element.name}`}>
            <ElementGlyph element={face.element.id} className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">{face.element.name}</span>
          </span>
        </div>
      </div>
    </article>
  );
}

/** Consistent card back for unrevealed discoveries (and future deck use). */
export function CardBack({ className = "", label = "Unrevealed Gubble card" }: { className?: string; label?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative aspect-[5/7] w-full max-w-[340px] rounded-card p-[4px] shadow-lift ${className}`}
      style={{ background: "linear-gradient(145deg, #7dd3fc, #3d4aa6 40%, #c77dff 75%, #ffd166)" }}
    >
      <div className="relative grid h-full place-items-center overflow-hidden rounded-[calc(var(--radius-card)-4px)] bg-night-900">
        <div className="grain absolute inset-0 opacity-70" aria-hidden="true" />
        <svg viewBox="0 0 200 280" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <pattern id="cb-dots" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="9" cy="9" r="2" fill="#4cc9f0" opacity="0.18" />
            </pattern>
            <radialGradient id="cb-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#c77dff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#c77dff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="200" height="280" fill="url(#cb-dots)" />
          <rect x="10" y="10" width="180" height="260" rx="16" fill="none" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="2" />
          <circle cx="100" cy="140" r="80" fill="url(#cb-glow)" />
          <circle cx="100" cy="140" r="46" fill="#151b47" stroke="#ffd166" strokeWidth="3" />
          <circle cx="92" cy="146" r="22" fill="#4cc9f0" />
          <circle cx="116" cy="124" r="9" fill="#ffb547" />
          <circle cx="118" cy="152" r="5" fill="#ff8a7a" />
          <ellipse cx="85" cy="138" rx="7" ry="4" fill="#fff" opacity="0.7" transform="rotate(-30 85 138)" />
        </svg>
        <span className="absolute bottom-5 font-display text-lg font-bold tracking-wide text-ink/80">Gubbles</span>
      </div>
    </div>
  );
}
