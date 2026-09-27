import { json, readJson, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { beginTotpEnrolment } from "@/lib/auth/service";

export const runtime = "nodejs";

/** Returns the new secret exactly once (it is stored only encrypted). */
export const POST = route(async (req) => {
  const s = await requireApiSession();
  return json(await beginTotpEnrolment(s.userId, await readJson(req)));
});
