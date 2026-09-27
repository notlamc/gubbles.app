import { json, readJson, route } from "@/lib/api/handler";
import { requirePendingMfaSession, setSessionCookie } from "@/lib/auth/context";
import { completeMfa } from "@/lib/auth/service";
import { deviceHint } from "@/lib/security/request";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const pending = await requirePendingMfaSession();
  const { session, method } = await completeMfa(pending, await readJson(req), { deviceHint: deviceHint(req) });
  await setSessionCookie(session);
  return json({ ok: true, method, next: "/play" });
});
