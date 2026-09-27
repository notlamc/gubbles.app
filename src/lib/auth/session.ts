import "server-only";
import { AUTH } from "@/lib/game/constants";
import { db } from "@/lib/db";
import { randomToken, sha256Hex } from "@/lib/security/crypto";

export type SessionStage = "ACTIVE" | "MFA_PENDING";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-gubbles_session" : "gubbles_session";

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export interface IssuedSession {
  token: string;
  sessionId: string;
  expiresAt: Date;
}

/** Create a new session. The opaque token goes to the cookie; only its hash is stored. */
export async function issueSession(userId: string, stage: SessionStage, deviceHint?: string): Promise<IssuedSession> {
  const token = randomToken(32);
  const ttl = stage === "ACTIVE" ? AUTH.SESSION_TTL_MS : AUTH.MFA_PENDING_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);
  const s = await db.session.create({
    data: { tokenHash: sha256Hex(token), userId, stage, expiresAt, deviceHint: deviceHint?.slice(0, 64) },
  });
  return { token, sessionId: s.id, expiresAt };
}

export interface LiveSession {
  id: string;
  userId: string;
  stage: SessionStage;
  expiresAt: Date;
}

/** Resolve a cookie token to a live (unexpired, unrevoked) session. */
export async function resolveSessionToken(token: string | undefined | null): Promise<LiveSession | null> {
  if (!token || token.length > 128) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256Hex(token) } });
  if (!s || s.revokedAt || s.expiresAt.getTime() <= Date.now()) return null;
  if (Date.now() - s.lastUsedAt.getTime() > AUTH.SESSION_TOUCH_INTERVAL_MS) {
    await db.session.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  return { id: s.id, userId: s.userId, stage: s.stage as SessionStage, expiresAt: s.expiresAt };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const r = await db.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
  return r.count;
}
