import { json, readJson, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { confirmContact } from "@/lib/auth/service";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const s = await requireApiSession();
  return json(await confirmContact(s.userId, await readJson(req)));
});
