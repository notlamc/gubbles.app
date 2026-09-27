"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { api } from "@/lib/client/api";
import { AUTH } from "@/lib/game/constants";
import { SignupSchema } from "@/lib/validation";
import { PasswordField, focusFirstError, splitApiError, without, zodFieldErrors, type FieldErrors } from "./bits";

const ORDER = ["email", "username", "phone", "password", "acceptTerms"];

export function SignupForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({ email: "", username: "", phone: "", password: "" });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof values) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (errors[key]) setErrors((errs) => without(errs, key));
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(undefined);
    const payload = { ...values, acceptTerms };
    const check = SignupSchema.safeParse(payload);
    if (!check.success) {
      const errs = zodFieldErrors(check.error);
      setErrors(errs);
      focusFirstError(formRef.current, errs, ORDER);
      return;
    }
    setBusy(true);
    const res = await api<{ userId: string; next: string }>("/auth/signup", { method: "POST", json: payload });
    if (res.ok) {
      router.push("/confirm");
      router.refresh();
      return;
    }
    setBusy(false);
    const { fields, form } = splitApiError(res.error, {
      EMAIL_TAKEN: "email",
      USERNAME_TAKEN: "username",
      PHONE_TAKEN: "phone",
    });
    setErrors(fields);
    setFormError(form);
    focusFirstError(formRef.current, fields, ORDER);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4" aria-describedby={formError ? "signup-error" : undefined}>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        value={values.email}
        onChange={set("email")}
        error={errors.email}
        placeholder="you@example.com"
      />
      <Field
        label="Username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={values.username}
        onChange={set("username")}
        error={errors.username}
        hint="3–20 letters, numbers or underscores. You can sign in with it."
        placeholder="bubble_hunter"
      />
      <Field
        label="Mobile phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        required
        value={values.phone}
        onChange={set("phone")}
        error={errors.phone}
        hint="International format with your country code, e.g. +44 7700 900123."
        placeholder="+44 7700 900123"
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        required
        minLength={AUTH.PASSWORD_MIN}
        maxLength={AUTH.PASSWORD_MAX}
        value={values.password}
        onChange={set("password")}
        error={errors.password}
        hint={`At least ${AUTH.PASSWORD_MIN} characters. A silly sentence works great.`}
      />

      <div className="space-y-1.5">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-night-950/40 p-3 text-sm text-muted">
          <input
            type="checkbox"
            name="acceptTerms"
            checked={acceptTerms}
            onChange={(e) => {
              setAcceptTerms(e.target.checked);
              if (errors.acceptTerms) setErrors((errs) => without(errs, "acceptTerms"));
            }}
            aria-invalid={errors.acceptTerms ? true : undefined}
            aria-describedby={errors.acceptTerms ? "terms-error" : undefined}
            className="mt-0.5 h-5 w-5 shrink-0 accent-sun-400"
          />
          <span>
            I&apos;ve read and accept the{" "}
            <Link href="/terms" target="_blank" rel="noopener" className="font-bold text-sun-300 underline underline-offset-4">
              proof-of-concept terms<span className="sr-only"> (opens in a new tab)</span>
            </Link>
            .
          </span>
        </label>
        {errors.acceptTerms ? (
          <p id="terms-error" role="alert" className="text-sm font-semibold text-danger-300">
            {errors.acceptTerms}
          </p>
        ) : null}
      </div>

      {formError ? (
        <div id="signup-error">
          <Notice tone="error" title="Hmm, that didn't work">
            {formError}
          </Notice>
        </div>
      ) : null}

      <Button type="submit" size="lg" loading={busy} className="w-full">
        {busy ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}
