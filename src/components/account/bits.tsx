"use client";

import { useCallback, useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import type { ZodError } from "zod";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/icons";
import type { ApiError } from "@/lib/client/api";

/** Shared client-side building blocks for the account / auth / security forms. */

export type FieldErrors = Record<string, string>;

/**
 * Turn an API error into per-field messages (from `fields` or a code → field map)
 * plus a form-level message when nothing field-specific applies.
 */
export function splitApiError(error: ApiError, codeToField: Record<string, string> = {}): { fields: FieldErrors; form?: string } {
  const fields: FieldErrors = {};
  if (error.fields) {
    for (const [key, messages] of Object.entries(error.fields)) {
      const first = messages[0];
      if (first) fields[key.split(".")[0] ?? key] = first;
    }
  }
  const target = codeToField[error.code];
  if (target) fields[target] = error.message;
  return { fields, form: Object.keys(fields).length ? undefined : error.message };
}

/** Copy of an error map without one key. */
export function without(errors: FieldErrors, key: string): FieldErrors {
  const next = { ...errors };
  delete next[key];
  return next;
}

/** First message per top-level path from a client-side zod check. */
export function zodFieldErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Move keyboard focus to the first input that has an error (by `name`). */
export function focusFirstError(form: HTMLFormElement | null, errors: FieldErrors, order: string[]) {
  const first = order.find((k) => errors[k]);
  if (!first || !form) return;
  const el = form.querySelector<HTMLElement>(`[name="${first}"]`);
  el?.focus();
}

/** Countdown to a moment in the future (e.g. "send a new code" cooldown). */
export function useCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(0);
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  const active = remaining > 0;

  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);

  const startUntil = useCallback((untilMs: number) => {
    setNow(Date.now());
    setUntil(untilMs);
  }, []);
  const startFor = useCallback((seconds: number) => {
    const t = Date.now();
    setNow(t);
    setUntil(t + seconds * 1000);
  }, []);

  return { remaining, active, startUntil, startFor };
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; hint?: ReactNode; error?: string };

/** Password input with a show/hide toggle. */
export function PasswordField(props: InputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? `Hide ${props.label.toLowerCase()}` : `Show ${props.label.toLowerCase()}`}
          className="rounded-pill px-3 py-1.5 text-xs font-bold text-muted hover:bg-white/5 hover:text-ink"
        >
          {visible ? "Hide" : "Show"}
        </button>
      }
    />
  );
}

/** 6-digit one-time code input. */
export function CodeField(props: InputProps) {
  return (
    <Field
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={7}
      placeholder="123456"
      style={{ letterSpacing: "0.35em", fontVariantNumeric: "tabular-nums" }}
      {...props}
      type="text"
    />
  );
}

/** Keep digits only (codes are 6 digits; users sometimes paste "123 456"). */
export const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 6);

/** Accessible copy-to-clipboard button with a short "Copied" confirmation. */
export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const t = window.setTimeout(() => setState("idle"), 2200);
    return () => window.clearTimeout(t);
  }, [state]);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("copied");
        } catch {
          setState("failed");
        }
      }}
      className={`inline-flex items-center gap-1.5 rounded-pill border border-white/15 bg-night-800/80 px-3 py-1.5 text-xs font-bold text-ink hover:bg-night-700 ${className}`}
    >
      {state === "copied" ? <Icon.Check className="h-3.5 w-3.5 text-mint-300" /> : <Icon.Copy className="h-3.5 w-3.5" />}
      <span aria-live="polite">{state === "copied" ? "Copied!" : state === "failed" ? "Copy failed — select it instead" : label}</span>
    </button>
  );
}

/** Small status badge that never relies on colour alone. */
export function StatusBadge({ ok, okLabel, pendingLabel }: { ok: boolean; okLabel: string; pendingLabel: string }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 rounded-pill border border-mint-400/40 bg-mint-400/10 px-2.5 py-1 text-xs font-bold text-mint-300">
      <Icon.Check className="h-3.5 w-3.5" /> {okLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-pill border border-sun-400/40 bg-sun-400/10 px-2.5 py-1 text-xs font-bold text-sun-200">
      <Icon.Info className="h-3.5 w-3.5" /> {pendingLabel}
    </span>
  );
}

/** Section wrapper used on the profile and security pages. */
export function Section({
  id,
  eyebrow,
  title,
  icon,
  children,
  description,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  icon?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="panel p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        {icon ? <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/5 text-sun-300">{icon}</span> : null}
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2 id={`${id}-title`} className="text-xl font-semibold text-ink">
            {title}
          </h2>
          {description ? <div className="mt-1 text-sm text-muted">{description}</div> : null}
        </div>
      </div>
      {children}
    </section>
  );
}
