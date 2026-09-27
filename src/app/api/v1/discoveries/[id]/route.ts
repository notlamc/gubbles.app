import { json, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { getDiscovery } from "@/lib/discovery/service";

export const runtime = "nodejs";

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireApiSession();
  const { id } = await params;
  return json({ discovery: await getDiscovery(s.userId, id) });
});
