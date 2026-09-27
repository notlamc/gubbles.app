import { json, readJson, route } from "@/lib/api/handler";
import { requestPasswordReset } from "@/lib/auth/service";
import { clientIp } from "@/lib/security/request";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  await requestPasswordReset(await readJson(req), { ip: clientIp(req) });
  // Identical response whether or not the account exists.
  return json({ ok: true, message: "If that email belongs to a Gubbles account, a reset code is on its way." });
});
