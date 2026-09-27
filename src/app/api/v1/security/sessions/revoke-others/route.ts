import { json, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { revokeAllSessions } from "@/lib/auth/session";

export const runtime = "nodejs";

export const POST = route(async () => {
  const s = await requireApiSession();
  return json({ revoked: await revokeAllSessions(s.userId, s.id) });
});
