import "server-only";
import { AppError } from "@/lib/api/errors";
import { env } from "@/lib/env";

/** Header every same-origin mutation from our clients must carry (forces a CORS preflight cross-site). */
export const CSRF_HEADER = "x-gubbles-csrf";

/**
 * CSRF defence for cookie-authenticated mutations:
 *  1. Origin (or Referer) must equal the configured APP_ORIGIN.
 *  2. A custom header must be present — cross-site forms cannot set it and
 *     cross-site fetch would need a preflight we never grant.
 * Combined with SameSite=Lax session cookies.
 */
export function assertSameOrigin(req: Request): void {
  const expected = env().APP_ORIGIN;
  const origin = req.headers.get("origin");
  let source = origin;
  if (!source) {
    const referer = req.headers.get("referer");
    if (referer) {
      try {
        source = new URL(referer).origin;
      } catch {
        source = null;
      }
    }
  }
  if (source !== expected) throw new AppError("BAD_ORIGIN", "This request did not come from Gubbles.");
  if (req.headers.get(CSRF_HEADER) !== "1") throw new AppError("BAD_ORIGIN", "Missing request verification header.");
}

/** Client IP for rate limiting. X-Forwarded-For is only trusted when TRUST_PROXY=1. */
export function clientIp(req: Request): string {
  if (env().TRUST_PROXY === "1") {
    const fwd = req.headers.get("x-forwarded-for");
    const first = fwd?.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return req.headers.get("x-real-ip")?.slice(0, 64) ?? "local";
}

/** Short, non-identifying device hint for the sessions list. */
export function deviceHint(req: Request): string {
  const ua = req.headers.get("user-agent") ?? "";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}
