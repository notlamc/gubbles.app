import { json, route } from "@/lib/api/handler";
import { clearSessionCookie, currentSession } from "@/lib/auth/context";
import { revokeSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export const POST = route(async () => {
  const s = await currentSession();
  if (s) await revokeSession(s.id);
  await clearSessionCookie();
  return json({ ok: true });
});
