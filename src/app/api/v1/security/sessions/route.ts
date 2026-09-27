import { json, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { listSessions } from "@/lib/auth/service";

export const runtime = "nodejs";

export const GET = route(async () => {
  const s = await requireApiSession();
  return json({ sessions: await listSessions(s.userId, s.id) });
});
