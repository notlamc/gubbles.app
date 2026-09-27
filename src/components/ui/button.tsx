import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "coral" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex select-none items-center whitespace-nowrap justify-center gap-2 rounded-pill font-display font-semibold tracking-tight transition-[transform,box-shadow,background-color,opacity] duration-150 ease-out-soft active:translate-y-[2px] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-sun-300 to-sun-500 text-sun-900 shadow-button hover:brightness-105 active:shadow-[0_3px_0_0_rgb(0_0_0/0.28)]",
  coral:
    "bg-gradient-to-b from-coral-400 to-coral-600 text-night-950 shadow-[0_6px_0_0_rgb(0_0_0/0.28),0_10px_24px_-8px_rgb(255_107_94/0.6)] hover:brightness-105",
  secondary: "border border-white/15 bg-night-800/80 text-ink hover:bg-night-700",
  ghost: "text-muted hover:bg-white/5 hover:text-ink",
  danger: "border border-danger-400/40 bg-danger-400/10 text-danger-300 hover:bg-danger-400/20",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-14 px-7 text-lg",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button {...props} disabled={props.disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, size, className)}>
      {loading ? <Spinner className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
