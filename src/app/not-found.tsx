import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { CardBack } from "@/components/card/GubbleCard";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo size="md" />
      <div className="w-36 animate-float">
        <CardBack label="An empty card back" />
      </div>
      <div>
        <h1 className="font-display text-3xl font-bold">Nothing hiding here</h1>
        <p className="mt-2 text-muted">We looked under every leaf. This page (or card) doesn&apos;t exist, or it isn&apos;t yours to see.</p>
      </div>
      <Link href="/" className={buttonClass("primary")}>Back to Gubbles</Link>
    </main>
  );
}
