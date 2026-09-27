import { json, route } from "@/lib/api/handler";
import { clearSessionCookie, requireApiSession } from "@/lib/auth/context";
import { revokeOwnSession } from "@/lib/auth/service";

export const runtime = "nodejs";

export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireApiSession();
  const { id } = await params;
  await revokeOwnSession(s.userId, id);
  if (id === s.id) await clearSessionCookie();
  return json({ ok: true, signedOutHere: id === s.id });
});
