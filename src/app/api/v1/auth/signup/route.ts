import { json, readJson, route } from "@/lib/api/handler";
import { setSessionCookie } from "@/lib/auth/context";
import { signUp } from "@/lib/auth/service";
import { clientIp, deviceHint } from "@/lib/security/request";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const { userId, session } = await signUp(await readJson(req), { ip: clientIp(req), deviceHint: deviceHint(req) });
  await setSessionCookie(session);
  return json({ userId, next: "/confirm" }, { status: 201 });
});
