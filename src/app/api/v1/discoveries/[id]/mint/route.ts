import { after } from "next/server";
import { json, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { processDueArtworkJobs } from "@/lib/artwork/jobs";
import { mintDiscovery } from "@/lib/cards/service";
import { requireConfirmedPlayer } from "@/lib/discovery/service";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Mint the stored candidate. Body is ignored: only the discovery id is accepted. */
export const POST = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireApiSession();
  await requireConfirmedPlayer(s.userId);
  const { id } = await params;
  const { card, alreadyMinted } = await mintDiscovery({ userId: s.userId, discoveryId: id });
  if (card.art.status === "ART_PENDING") {
    // The mint transaction has committed; generate art after the response is sent.
    after(() => processDueArtworkJobs({ cardId: card.id, limit: 1 }).catch((e) => console.error("[gubbles:artwork]", e)));
  }
  return json({ card, alreadyMinted }, { status: alreadyMinted ? 200 : 201 });
});
