"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Button, Spinner } from "@/components/ui/button";
import { api, type ApiError } from "@/lib/client/api";
import type { MintedCardView } from "@/lib/cards/view";

type Art = MintedCardView["art"];

/** Honest artwork status: polls while generating, offers a free repair if generation failed. */
export function ArtStatusPanel({ cardId, initial }: { cardId: string; initial: Art }) {
  const router = useRouter();
  const [art, setArt] = useState(initial);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const polls = useRef(0);

  useEffect(() => {
    if (art.status !== "ART_PENDING") return;
    const t = setInterval(async () => {
      polls.current += 1;
      const res = await api<{ art: Art }>(`/cards/${cardId}/artwork`);
      if (res.ok && res.data.art.status !== "ART_PENDING") {
        setArt(res.data.art);
        router.refresh();
      }
    }, polls.current > 30 ? 8000 : 2500);
    return () => clearInterval(t);
  }, [art.status, cardId, router]);

  async function retry() {
    setRetrying(true);
    setError(null);
    const res = await api(`/cards/${cardId}/artwork/retry`, { method: "POST" });
    setRetrying(false);
    if (!res.ok) return setError(res.error);
    setArt({ ...art, status: "ART_PENDING" });
    router.refresh();
  }

  return (
    <section aria-labelledby="art-title" className="panel p-5" aria-live="polite">
      <h2 id="art-title" className="font-display text-lg font-bold">Artwork</h2>
      {art.status === "ART_PENDING" ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-sun-200">
          <Spinner className="h-4 w-4" /> Generating artwork… Your card is minted and safe; its illustration is still being painted. The preview art is shown meanwhile.
        </p>
      ) : art.status === "ART_READY" ? (
        <div className="mt-2 space-y-1 text-sm">
          <p className="flex items-center gap-2 text-mint-300">
            <Icon.Check className="h-4 w-4" /> Artwork ready
          </p>
          <p className="text-muted">
            {art.isStub ? (
              <>Illustrated by the <strong>local stub renderer</strong> (deterministic development art — not AI-generated).</>
            ) : (
              <>AI illustration via <strong>{art.provider}</strong> / {art.model}, created from this card&apos;s fixed traits.</>
            )}
          </p>
          {art.generatedAt ? <p className="text-xs text-faint">Created {new Date(art.generatedAt).toUTCString()}</p> : null}
        </div>
      ) : (
        <div className="mt-2 space-y-3 text-sm">
          <p className="text-danger-300">Artwork generation failed after several tries. Your card and demo credit are safe.</p>
          <Button variant="secondary" onClick={retry} loading={retrying}>
            <Icon.Refresh className="h-4 w-4" /> Try generating again (free)
          </Button>
          {error ? <p role="alert" className="text-danger-300">{error.message}</p> : null}
        </div>
      )}
    </section>
  );
}
