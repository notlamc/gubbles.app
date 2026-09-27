import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { AppError } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { SESSION_COOKIE, resolveSessionToken, sessionCookieOptions, type IssuedSession, type LiveSession } from "./session";

/** Read and validate the session cookie for the current request (memoized per request). */
export const currentSession = cache(async (): Promise<LiveSession | null> => {
  const jar = await cookies();
  return resolveSessionToken(jar.get(SESSION_COOKIE)?.value);
});

export async function setSessionCookie(s: IssuedSession) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, s.token, sessionCookieOptions(s.expiresAt));
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
}

/** API guard: a fully authenticated session (second factor done). */
export async function requireApiSession(): Promise<LiveSession> {
  const s = await currentSession();
  if (!s) throw new AppError("UNAUTHENTICATED", "Please sign in.");
  if (s.stage !== "ACTIVE") throw new AppError("MFA_REQUIRED", "Finish two-step verification first.");
  return s;
}

/** API guard: a session awaiting its second factor. */
export async function requirePendingMfaSession(): Promise<LiveSession> {
  const s = await currentSession();
  if (!s || s.stage !== "MFA_PENDING") throw new AppError("UNAUTHENTICATED", "Your sign-in expired. Please start again.");
  return s;
}

export const currentUser = cache(async () => {
  const s = await currentSession();
  if (!s || s.stage !== "ACTIVE") return null;
  return db.user.findUnique({ where: { id: s.userId } });
});

/** Page guard: redirect to sign-in (or MFA) when not fully authenticated. */
export async function requirePageUser(opts: { requireConfirmed?: boolean } = {}) {
  const s = await currentSession();
  if (!s) redirect("/signin");
  if (s.stage === "MFA_PENDING") redirect("/signin/two-step");
  const user = await currentUser();
  if (!user) redirect("/signin");
  if (opts.requireConfirmed && (!user.emailConfirmedAt || !user.phoneConfirmedAt)) redirect("/confirm");
  return { user, session: s };
}
