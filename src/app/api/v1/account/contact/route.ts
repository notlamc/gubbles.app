import { json, readJson, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { requestContactChange } from "@/lib/auth/service";

export const runtime = "nodejs";

/** Start changing email or phone. The current value stays active until the new one is confirmed. */
export const POST = route(async (req) => {
  const s = await requireApiSession();
  const r = await requestContactChange(s.userId, await readJson(req));
  return json({ sent: true, expiresAt: r.expiresAt, resendAvailableAt: r.resendAvailableAt });
});
