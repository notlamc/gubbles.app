import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Svg({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? "img" : undefined} {...props}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const Icon = {
  Home: (p: IconProps) => <Svg {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></Svg>,
  Cards: (p: IconProps) => <Svg {...p}><rect x="7" y="3" width="13" height="17" rx="2.5" /><path d="M4 7v12a2 2 0 0 0 2 2h9" /></Svg>,
  Scan: (p: IconProps) => <Svg {...p}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M4 12h16" /></Svg>,
  User: (p: IconProps) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></Svg>,
  Shield: (p: IconProps) => <Svg {...p}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /></Svg>,
  Coin: (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5c.5-1 1.4-1.5 2.5-1.5 1.5 0 2.5.8 2.5 2 0 2.5-5 1.5-5 4 0 1.2 1 2 2.5 2 1.1 0 2-.5 2.5-1.5M12 6.5V8M12 16v1.5" /></Svg>,
  Sparkle: (p: IconProps) => <Svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></Svg>,
  Arrow: (p: IconProps) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>,
  Back: (p: IconProps) => <Svg {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></Svg>,
  Pin: (p: IconProps) => <Svg {...p}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></Svg>,
  Upload: (p: IconProps) => <Svg {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></Svg>,
  Camera: (p: IconProps) => <Svg {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></Svg>,
  Copy: (p: IconProps) => <Svg {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></Svg>,
  Check: (p: IconProps) => <Svg {...p}><path d="M5 12.5 10 17 19 7" /></Svg>,
  X: (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>,
  Expand: (p: IconProps) => <Svg {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Svg>,
  Info: (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>,
  Key: (p: IconProps) => <Svg {...p}><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M15 8l2 2" /></Svg>,
  Logout: (p: IconProps) => <Svg {...p}><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></Svg>,
  External: (p: IconProps) => <Svg {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Svg>,
  Refresh: (p: IconProps) => <Svg {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></Svg>,
  Globe: (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z" /></Svg>,
  Star: (p: IconProps) => <Svg {...p}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z" /></Svg>,
  People: (p: IconProps) => <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.5c2.5 0 4.5 1.5 5.5 4.5" /></Svg>,
};

// ---- Game glyphs (filled, colourful) ---------------------------------------

export function ElementGlyph({ element, className = "h-5 w-5" }: { element: string; className?: string }) {
  switch (element) {
    case "tide":
      return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2v3c-2.5 0-2.5-2-5-2s-2.5 2-5 2-2.5-2-5-2-2.5 2-5 2Z" fill="currentColor" /><path d="M12 3c3 4 5 6 5 8.5a5 5 0 0 1-10 0C7 9 9 7 12 3Z" fill="currentColor" opacity="0.65" /></svg>;
    case "gale":
      return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M3 8h11a3 3 0 1 0-3-3" /><path d="M3 12h16a3 3 0 1 1-3 3" /><path d="M3 16h7" /></svg>;
    case "ember":
      return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1-4 2.5-5 0 2 .8 3 2 3.5C11 9 10.5 5.5 12 2Z" fill="currentColor" /></svg>;
    case "grove":
      return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M20 3C9 3 4 8 4 15c0 2 .5 3.5 1 4.5C7 13 11 10 15 8.5 11 11 8 15 7 21c7 0 13-5 13-18Z" fill="currentColor" /></svg>;
    default:
      return null;
  }
}

export function TraitGlyph({ icon, className = "h-5 w-5" }: { icon: string; className?: string }) {
  const common = { className, "aria-hidden": true as const, viewBox: "0 0 24 24" };
  switch (icon) {
    case "bubble": return <svg {...common}><circle cx="10" cy="13" r="6" fill="currentColor" opacity="0.8" /><circle cx="17.5" cy="6.5" r="3" fill="currentColor" opacity="0.6" /><circle cx="8" cy="11" r="1.6" fill="#fff" opacity="0.8" /></svg>;
    case "swirl": return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 12a2 2 0 1 1 2-2c0 3-3 5-6 4S4 10 6 7s7-4 10-1 3 9-2 11-9-1-10-4" /></svg>;
    case "wind": return <ElementGlyph element="gale" className={className} />;
    case "shield": return <svg {...common}><path d="M12 2 4 5v6c0 5.5 3.5 9 8 11 4.5-2 8-5.5 8-11V5Z" fill="currentColor" /></svg>;
    case "flame": return <ElementGlyph element="ember" className={className} />;
    case "spark": return <svg {...common}><path d="M13 2 5 14h6l-2 8 10-13h-6Z" fill="currentColor" /></svg>;
    case "leaf": return <ElementGlyph element="grove" className={className} />;
    case "root": return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 2v9M12 11c-3 2-5 5-5 10M12 11c3 2 5 5 5 10M12 11v10" /></svg>;
    case "heart": return <svg {...common}><path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11Z" fill="currentColor" /></svg>;
    case "eye": return <svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" fill="currentColor" opacity="0.8" /><circle cx="12" cy="12" r="3.2" fill="#0c1030" /></svg>;
    case "snack": return <svg {...common}><circle cx="12" cy="12" r="8" fill="currentColor" /><circle cx="9" cy="10" r="1.2" fill="#0c1030" /><circle cx="14" cy="14" r="1.2" fill="#0c1030" /><circle cx="14.5" cy="9" r="1" fill="#0c1030" /></svg>;
    default: return <svg {...common}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z" fill="currentColor" /></svg>;
  }
}

export function StatGlyph({ stat, className = "h-5 w-5" }: { stat: "power" | "guard" | "speed"; className?: string }) {
  if (stat === "power") return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="m12 2 2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4Z" fill="currentColor" /></svg>;
  if (stat === "guard") return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M12 2 4 5v6c0 5.5 3.5 9 8 11 4.5-2 8-5.5 8-11V5Z" fill="currentColor" /><path d="M12 4.5v15" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" /></svg>;
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M3 17c5-1 9-4 12-9l2 3 4-7-8 1 3 2c-3 4-7 7-13 8Z" fill="currentColor" /><path d="M4 21c4-1 7-2 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>;
}

export function RarityGem({ rarity, className = "h-4 w-4" }: { rarity: string; className?: string }) {
  const facets = { common: 1, uncommon: 2, rare: 3, epic: 4, mythic: 5 }[rarity] ?? 1;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M6 3h12l4 6-10 12L2 9Z" fill="currentColor" />
      <path d="M2 9h20M9 3 7 9l5 12 5-12-2-6" stroke="#0c1030" strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
      {facets >= 4 ? <circle cx="12" cy="7" r="1.6" fill="#fff" opacity="0.9" /> : null}
    </svg>
  );
}
