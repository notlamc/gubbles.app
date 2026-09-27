import { json, readJson, route } from "@/lib/api/handler";
import { requireApiSession, setSessionCookie } from "@/lib/auth/context";
import { changePassword } from "@/lib/auth/service";
import { deviceHint } from "@/lib/security/request";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const s = await requireApiSession();
  const fresh = await changePassword(s, await readJson(req), { deviceHint: deviceHint(req) });
  await setSessionCookie(fresh);
  return json({ ok: true, otherSessionsSignedOut: true });
});
