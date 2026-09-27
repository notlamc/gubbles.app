import { json, readJson, route } from "@/lib/api/handler";
import { setSessionCookie } from "@/lib/auth/context";
import { signIn } from "@/lib/auth/service";
import { clientIp, deviceHint } from "@/lib/security/request";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const { session, mfaRequired } = await signIn(await readJson(req), { ip: clientIp(req), deviceHint: deviceHint(req) });
  await setSessionCookie(session);
  return json({ mfaRequired, next: mfaRequired ? "/signin/two-step" : "/play" });
});
