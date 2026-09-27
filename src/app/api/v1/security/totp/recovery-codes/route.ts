import { json, readJson, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { regenerateRecoveryCodes } from "@/lib/auth/service";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const s = await requireApiSession();
  return json(await regenerateRecoveryCodes(s.userId, await readJson(req)));
});
