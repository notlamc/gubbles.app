/** Gubbles wordmark: rounded letters with a bubble cluster. Pure SVG + text, no external assets. */
export function Logo({ size = "md", className = "" }: { size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const text = { sm: "text-xl", md: "text-2xl", lg: "text-4xl", xl: "text-6xl sm:text-7xl" }[size];
  const bubble = { sm: 16, md: 20, lg: 30, xl: 46 }[size];
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <svg width={bubble} height={bubble} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
        <defs>
          <radialGradient id="logo-b" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#e0f7ff" />
            <stop offset="60%" stopColor="#4cc9f0" />
            <stop offset="100%" stopColor="#3d4aa6" />
          </radialGradient>
        </defs>
        <circle cx="17" cy="22" r="14" fill="url(#logo-b)" />
        <circle cx="32" cy="9" r="6" fill="#ffb547" />
        <circle cx="33" cy="26" r="3.5" fill="#ff8a7a" />
        <ellipse cx="12" cy="16" rx="4.5" ry="2.6" fill="#fff" opacity="0.7" transform="rotate(-30 12 16)" />
      </svg>
      <span className={`font-display font-bold leading-none tracking-tight text-ink ${text}`}>
        Gubbles
      </span>
    </span>
  );
}
