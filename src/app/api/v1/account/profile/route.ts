import { json, readJson, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { publicAccount, updateProfile } from "@/lib/auth/service";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export const GET = route(async () => {
  const s = await requireApiSession();
  return json({ account: publicAccount(await db.user.findUniqueOrThrow({ where: { id: s.userId } })) });
});

export const PATCH = route(async (req) => {
  const s = await requireApiSession();
  return json({ account: await updateProfile(s.userId, await readJson(req)) });
});
