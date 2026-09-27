import { after } from "next/server";
import { json, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { processDueArtworkJobs, retryFailedArtwork } from "@/lib/artwork/jobs";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Manual repair after ART_FAILED. Never mints again and never charges again. */
export const POST = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireApiSession();
  const { id } = await params;
  await retryFailedArtwork(s.userId, id);
  after(() => processDueArtworkJobs({ cardId: id, limit: 1 }).catch((e) => console.error("[gubbles:artwork]", e)));
  return json({ ok: true, status: "ART_PENDING" }, { status: 202 });
});
