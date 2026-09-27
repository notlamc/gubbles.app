import { json, route } from "@/lib/api/handler";
import { requireApiSession } from "@/lib/auth/context";
import { CollectionFilterSchema, listCollection } from "@/lib/cards/service";

export const runtime = "nodejs";

export const GET = route(async (req) => {
  const s = await requireApiSession();
  const sp = req.nextUrl.searchParams;
  const filter = CollectionFilterSchema.parse({
    family: sp.get("family") || undefined,
    element: sp.get("element") || undefined,
    rarity: sp.get("rarity") || undefined,
  });
  return json(await listCollection(s.userId, filter));
});
