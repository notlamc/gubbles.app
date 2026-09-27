"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client/api";
import { EmailSchema, PhoneSchema } from "@/lib/validation";
import { CodeField, PasswordField, StatusBadge, digitsOnly, focusFirstError, splitApiError, without, type FieldErrors } from "./bits";

type Channel = "email" | "phone";
type Step = "idle" | "request" | "confirm";

/** Change email or phone: password → code to the NEW address → confirm. The old value stays active until then. */
export function ContactChange({ channel, current, confirmed }: { channel: Channel; current: string; confirmed: boolean }) {
  const router = useRouter();
  const headingId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<Step>("idle");
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [busy, setBusy] = useState(false);

  const label = channel === "email" ? "Email" : "Phone";
  const noun = channel === "email" ? "email address" : "phone number";

  function reset(to: Step) {
    setStep(to);
    setPassword("");
    setCode("");
    setErrors({});
    setFormError(undefined);
  }

  async function onRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(undefined);
    const errs: FieldErrors = {};
    const check = (channel === "email" ? EmailSchema : PhoneSchema).safeParse(value);
    if (!check.success) errs.value = check.error.issues[0]?.message ?? `Enter a valid ${noun}.`;
    if (!password) errs.password = "Enter your current password.";
    if (Object.keys(errs).length) {
      setErrors(errs);
      focusFirstError(formRef.current, errs, ["value", "password"]);
      return;
    }
    setBusy(true);
    const res = await api<{ sent: boolean }>("/account/contact", { method: "POST", json: { channel, value, password } });
    setBusy(false);
    if (res.ok) {
      setPassword("");
      setErrors({});
      setStep("confirm");
      return;
    }
    const { fields, form } = splitApiError(res.error, {
      INVALID_CREDENTIALS: "password",
      EMAIL_TAKEN: "value",
      PHONE_TAKEN: "value",
    });
    setErrors(fields);
    setFormError(form);
    focusFirstError(formRef.current, fields, ["value", "password"]);
  }

  async function onConfirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(undefined);
    if (code.length !== 6) return setErrors({ code: "Codes are 6 digits." });
    setBusy(true);
    const res = await api<{ account: unknown }>("/account/contact/confirm", { method: "POST", json: { channel, code } });
    setBusy(false);
    if (res.ok) {
      setDone(`${label} updated to ${value}. Shiny!`);
      setValue("");
      reset("idle");
      router.refresh();
      return;
    }
    const { fields, form } = splitApiError(res.error, {
      INVALID_CODE: "code",
      CODE_EXPIRED: "code",
      TOO_MANY_ATTEMPTS: "code",
    });
    setErrors(fields);
    setFormError(form);
  }

  return (
    <div className="rounded-card border border-white/10 bg-night-950/40 p-4" role="group" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={headingId} className="font-semibold text-ink">
            {label}
          </h3>
          <p className="break-all text-sm text-muted">{current}</p>
        </div>
        <StatusBadge ok={confirmed} okLabel="Confirmed" pendingLabel="Not confirmed" />
      </div>

      <p aria-live="polite" className="mt-2 text-sm font-bold text-mint-300">
        {done ?? ""}
      </p>

      {step === "idle" ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={() => {
            setDone(undefined);
            reset("request");
          }}
        >
          Change {label.toLowerCase()}
        </Button>
      ) : null}

      {step === "request" ? (
        <form ref={formRef} onSubmit={onRequest} noValidate className="mt-3 animate-fade-up space-y-3">
          <p className="text-sm text-muted">
            We&apos;ll send a code to the <strong className="text-ink">new</strong> {noun}. Your current one keeps working until
            you confirm.
          </p>
          <Field
            label={`New ${noun}`}
            name="value"
            type={channel === "email" ? "email" : "tel"}
            inputMode={channel === "email" ? "email" : "tel"}
            autoComplete={channel === "email" ? "email" : "tel"}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (errors.value) setErrors((x) => without(x, "value"));
            }}
            error={errors.value}
            hint={channel === "phone" ? "International format with country code, e.g. +44 7700 900123." : undefined}
          />
          <PasswordField
            label="Current password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((x) => without(x, "password"));
            }}
            error={errors.password}
          />
          {formError ? <Notice tone="error">{formError}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={busy}>
              Send code
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => reset("idle")}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {step === "confirm" ? (
        <form onSubmit={onConfirm} noValidate className="mt-3 animate-fade-up space-y-3">
          <Notice tone="info" title="Code sent" role="status">
            Enter the code we sent to <strong className="break-all">{value}</strong>. Until you do, {current} stays on your
            account.
          </Notice>
          <CodeField
            label="6-digit code"
            name="code"
            value={code}
            onChange={(e) => {
              setCode(digitsOnly(e.target.value));
              if (errors.code) setErrors((x) => without(x, "code"));
            }}
            error={errors.code}
          />
          {formError ? <Notice tone="error">{formError}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={busy}>
              <Icon.Check className="h-4 w-4" /> Confirm new {label.toLowerCase()}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => reset("request")}>
              Resend / edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setValue("");
                reset("idle");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
