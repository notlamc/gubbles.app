"use client";

import { buttonClass } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-3xl font-bold">A Gubble chewed the cables</h1>
      <p className="text-muted">Something went wrong on our side. It&apos;s not you — please try again.</p>
      <button type="button" onClick={reset} className={buttonClass("primary")}>
        Try again
      </button>
    </main>
  );
}
