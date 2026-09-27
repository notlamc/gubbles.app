import { after } from "next/server";
import { json, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { processDueArtworkJobs } from "@/lib/artwork/jobs";
import { getArtStatus } from "@/lib/cards/service";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Poll artwork status. Also nudges any due job for this card (e.g. a scheduled retry). */
export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireApiSession();
  const { id } = await params;
  const art = await getArtStatus(s.userId, id);
  if (art.status === "ART_PENDING") {
    after(() => processDueArtworkJobs({ cardId: id, limit: 1 }).catch((e) => console.error("[gubbles:artwork]", e)));
  }
  return json({ art });
});
