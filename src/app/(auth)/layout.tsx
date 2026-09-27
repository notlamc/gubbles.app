import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

/** Decorative floating bubbles behind the auth panel. Pure CSS, hidden from assistive tech. */
const BUBBLES: { className: string; style: CSSProperties }[] = [
  { className: "left-[-3rem] top-24 h-40 w-40 from-lagoon-300/40 to-night-500/10", style: { animationDelay: "0s" } },
  { className: "right-[-2rem] top-10 h-24 w-24 from-sun-300/50 to-coral-500/10", style: { animationDelay: "-1.5s" } },
  { className: "right-6 top-[45%] h-12 w-12 from-coral-300/50 to-coral-600/10", style: { animationDelay: "-3s" } },
  { className: "left-8 bottom-24 h-16 w-16 from-lilac-300/40 to-lilac-400/5", style: { animationDelay: "-2.2s" } },
  { className: "right-[-4rem] bottom-[-3rem] h-56 w-56 from-mint-300/25 to-lagoon-400/5", style: { animationDelay: "-0.8s" } },
  { className: "left-[40%] top-4 h-6 w-6 from-ink/50 to-lagoon-300/10", style: { animationDelay: "-4s" } },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            style={b.style}
            className={`absolute animate-float rounded-full bg-gradient-to-br shadow-[inset_-6px_-8px_20px_rgb(0_0_0/0.25),inset_6px_6px_14px_rgb(255_255_255/0.25)] ${b.className}`}
          />
        ))}
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-8 sm:pt-12">
        <header className="flex justify-center pb-6">
          <Link href="/" aria-label="Gubbles home" className="rounded-xl">
            <Logo size="lg" />
          </Link>
        </header>

        <main id="main" className="panel grain animate-pop-in p-5 sm:p-8">
          {children}
        </main>

        <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-faint">
          <span>A proof of concept — nothing here costs real money.</span>
          <Link href="/terms" className="font-bold text-muted underline-offset-4 hover:text-ink hover:underline">
            Terms
          </Link>
        </footer>
      </div>
    </div>
  );
}
