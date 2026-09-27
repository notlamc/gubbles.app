import { json, readJson, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { activateTotp } from "@/lib/auth/service";

export const runtime = "nodejs";

/** Returns single-use recovery codes exactly once (stored hashed). */
export const POST = route(async (req) => {
  const s = await requireApiSession();
  return json(await activateTotp(s.userId, await readJson(req)));
});
