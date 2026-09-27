"use client";

/** Minimal JSON API client for the web UI. Every mutation carries the CSRF header. */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  fields?: Record<string, string[]>;
  status: number;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export async function api<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "DELETE"; json?: unknown; form?: FormData; signal?: AbortSignal } = {},
): Promise<ApiResult<T>> {
  const method = opts.method ?? (opts.json !== undefined || opts.form ? "POST" : "GET");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (method !== "GET") headers["x-gubbles-csrf"] = "1";
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { method, headers, body, credentials: "same-origin", signal: opts.signal });
  } catch {
    return { ok: false, error: { code: "NETWORK", message: "Couldn't reach Gubbles. Check your connection and try again.", status: 0 } };
  }
  const payload = (await res.json().catch(() => null)) as ({ error?: Omit<ApiError, "status"> } & T) | null;
  if (!res.ok || !payload) {
    const err = payload?.error ?? { code: "INTERNAL", message: "Something went wrong. Please try again." };
    return { ok: false, error: { ...err, status: res.status } };
  }
  return { ok: true, data: payload as T };
}
