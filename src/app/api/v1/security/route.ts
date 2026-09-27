import { json, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { listSessions, securityOverview } from "@/lib/auth/service";

export const runtime = "nodejs";

export const GET = route(async () => {
  const s = await requireApiSession();
  const [overview, sessions] = await Promise.all([securityOverview(s.userId), listSessions(s.userId, s.id)]);
  return json({ ...overview, sessions });
});
