import { json, route } from "@/lib/api/handler";
import { readDiscoveryUpload } from "@/lib/api/upload";
import { requireApiSession } from "@/lib/auth/context";
import { discoverFromImage } from "@/lib/discovery/service";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Upload a QR image + fresh browser location → deterministic discovery preview. */
export const POST = route(async (req) => {
  const s = await requireApiSession();
  const { image, location } = await readDiscoveryUpload(req);
  const discovery = await discoverFromImage({ userId: s.userId, image, location });
  return json({ discovery }, { status: discovery.reused ? 200 : 201 });
});
