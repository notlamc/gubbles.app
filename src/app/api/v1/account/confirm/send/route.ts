import { json, readJson, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { sendConfirmation } from "@/lib/auth/service";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const s = await requireApiSession();
  const r = await sendConfirmation(s.userId, await readJson(req));
  return json("alreadyConfirmed" in r ? { alreadyConfirmed: true } : { sent: true, expiresAt: r.expiresAt, resendAvailableAt: r.resendAvailableAt });
});
