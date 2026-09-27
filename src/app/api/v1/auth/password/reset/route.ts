import { json, readJson, route } from "@/lib/api/handler";
import { resetPassword } from "@/lib/auth/service";
import { clientIp } from "@/lib/security/request";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  await resetPassword(await readJson(req), { ip: clientIp(req) });
  return json({ ok: true, next: "/signin" });
});
