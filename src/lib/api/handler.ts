import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { AppError, isAppError } from "./errors";
import { assertSameOrigin } from "@/lib/security/request";

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown>; fields?: Record<string, string[]> };
}

export function errorResponse(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof ZodError) {
    const fields: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const k = issue.path.join(".") || "_";
      (fields[k] ??= []).push(issue.message);
    }
    const first = err.issues[0]?.message ?? "Please check your input.";
    return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: first, fields } }, { status: 400, headers: noStore });
  }
  if (isAppError(err)) {
    const headers: Record<string, string> = { ...noStore };
    const retry = err.details?.retryAfterSeconds;
    if (typeof retry === "number") headers["Retry-After"] = String(retry);
    return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status, headers });
  }
  console.error("[gubbles:api] unhandled error", err instanceof Error ? err.stack : err);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." } }, { status: 500, headers: noStore });
}

export const noStore = { "Cache-Control": "no-store" } as const;

export function json<T>(data: T, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(data, { status: init?.status ?? 200, headers: { ...noStore, ...init?.headers } });
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Wrap a route handler: CSRF check for mutations + uniform error responses. */
export function route<C>(handler: Handler<C>, opts: { mutation?: boolean } = {}): Handler<C> {
  return async (req, ctx) => {
    try {
      const mutation = opts.mutation ?? !["GET", "HEAD", "OPTIONS"].includes(req.method);
      if (mutation) assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Parse a JSON body with a size bound. */
export async function readJson(req: Request, maxBytes = 16 * 1024): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new AppError("VALIDATION_FAILED", "Request body is too large.");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("VALIDATION_FAILED", "Request body must be JSON.");
  }
}
