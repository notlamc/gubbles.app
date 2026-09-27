import { json, route } from "@/lib/api/handler";
import { currentSession, currentUser } from "@/lib/auth/context";
import { publicAccount } from "@/lib/auth/service";

export const runtime = "nodejs";

export const GET = route(async () => {
  const s = await currentSession();
  if (!s) return json({ authenticated: false });
  if (s.stage === "MFA_PENDING") return json({ authenticated: false, mfaPending: true });
  const user = await currentUser();
  return json({ authenticated: Boolean(user), account: user ? publicAccount(user) : null });
});
