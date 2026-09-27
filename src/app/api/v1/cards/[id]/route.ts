import { json, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { getOwnedCard } from "@/lib/cards/service";

export const runtime = "nodejs";

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireApiSession();
  const { id } = await params;
  return json(await getOwnedCard(s.userId, id));
});
