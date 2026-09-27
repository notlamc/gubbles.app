"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { api } from "@/lib/client/api";
import { AUTH } from "@/lib/game/constants";
import { EmailSchema, PasswordSchema } from "@/lib/validation";
import { CodeField, PasswordField, digitsOnly, focusFirstError, splitApiError, useCooldown, without, type FieldErrors } from "./bits";

const RESEND_SECONDS = Math.round(AUTH.CODE_RESEND_COOLDOWN_MS / 1000);

export function ForgotPasswordFlow() {
  const router = useRouter();
  const resetRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [sentMessage, setSentMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown();

  async function requestCode(): Promise<boolean> {
    setFormError(undefined);
    const check = EmailSchema.safeParse(email);
    if (!check.success) {
      setErrors({ email: check.error.issues[0]?.message ?? "Enter a valid email address." });
      return false;
    }
    setBusy(true);
    const res = await api<{ ok: boolean; message: string }>("/auth/password/forgot", { method: "POST", json: { email } });
    setBusy(false);
    if (!res.ok) {
      const { fields, form } = splitApiError(res.error);
      setErrors(fields);
      setFormError(form);
      return false;
    }
    setErrors({});
    setSentMessage(res.data.message);
    cooldown.startFor(RESEND_SECONDS);
    return true;
  }

  async function onEmailSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (await requestCode()) setStep("reset");
  }

  async function onResetSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(undefined);
    const errs: FieldErrors = {};
    if (code.length !== 6) errs.code = "Codes are 6 digits.";
    const pw = PasswordSchema.safeParse(newPassword);
    if (!pw.success) errs.newPassword = pw.error.issues[0]?.message ?? "Choose a longer password.";
    if (Object.keys(errs).length) {
      setErrors(errs);
      focusFirstError(resetRef.current, errs, ["code", "newPassword"]);
      return;
    }
    setBusy(true);
    const res = await api<{ ok: boolean; next: string }>("/auth/password/reset", { method: "POST", json: { email, code, newPassword } });
    if (res.ok) {
      router.push("/signin?reset=1");
      return;
    }
    setBusy(false);
    const { fields, form } = splitApiError(res.error, { INVALID_CODE: "code", TOO_MANY_ATTEMPTS: "code", CODE_EXPIRED: "code" });
    setErrors(fields);
    setFormError(form);
    focusFirstError(resetRef.current, fields, ["code", "newPassword"]);
  }

  if (step === "email") {
    return (
      <form onSubmit={onEmailSubmit} noValidate className="animate-fade-up space-y-4">
        <Field
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((x) => without(x, "email"));
          }}
          error={errors.email}
          hint="The email address on your Gubbles account."
        />
        {formError ? <Notice tone="error">{formError}</Notice> : null}
        <Button type="submit" size="lg" loading={busy} className="w-full">
          Send me a reset code
        </Button>
      </form>
    );
  }

  return (
    <form ref={resetRef} onSubmit={onResetSubmit} noValidate className="animate-fade-up space-y-4">
      <Notice tone="info" title="Check your inbox" role="status">
        {sentMessage} It&apos;s valid for {Math.round(AUTH.CODE_TTL_MS / 60000)} minutes.
      </Notice>

      <p className="text-sm text-muted">
        Resetting for <strong className="break-all text-ink">{email}</strong>{" "}
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setCode("");
            setErrors({});
            setFormError(undefined);
          }}
          className="rounded-pill px-2 py-0.5 font-bold text-lagoon-300 hover:bg-white/5"
        >
          Change
        </button>
      </p>

      <CodeField
        label="6-digit reset code"
        name="code"
        value={code}
        onChange={(e) => {
          setCode(digitsOnly(e.target.value));
          if (errors.code) setErrors((x) => without(x, "code"));
        }}
        error={errors.code}
      />
      <PasswordField
        label="New password"
        name="newPassword"
        autoComplete="new-password"
        minLength={AUTH.PASSWORD_MIN}
        maxLength={AUTH.PASSWORD_MAX}
        value={newPassword}
        onChange={(e) => {
          setNewPassword(e.target.value);
          if (errors.newPassword) setErrors((x) => without(x, "newPassword"));
        }}
        error={errors.newPassword}
        hint={`At least ${AUTH.PASSWORD_MIN} characters. Every device will be signed out afterwards.`}
      />

      {formError ? <Notice tone="error">{formError}</Notice> : null}

      <Button type="submit" size="lg" loading={busy} className="w-full">
        Set new password
      </Button>

      <div className="text-center">
        <Button type="button" variant="ghost" size="sm" disabled={cooldown.active || busy} onClick={() => void requestCode()}>
          {cooldown.active ? `Send another code in ${cooldown.remaining}s` : "Send another code"}
        </Button>
      </div>
    </form>
  );
}
