"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { api } from "@/lib/client/api";
import { SigninSchema } from "@/lib/validation";
import { PasswordField, focusFirstError, splitApiError, without, zodFieldErrors, type FieldErrors } from "./bits";

const ORDER = ["identifier", "password"];

export function SigninForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(undefined);
    const check = SigninSchema.safeParse({ identifier, password });
    if (!check.success) {
      const errs = zodFieldErrors(check.error);
      setErrors(errs);
      focusFirstError(formRef.current, errs, ORDER);
      return;
    }
    setErrors({});
    setBusy(true);
    const res = await api<{ mfaRequired: boolean; next: string }>("/auth/signin", { method: "POST", json: { identifier, password } });
    if (res.ok) {
      router.push(res.data.next);
      router.refresh();
      return;
    }
    setBusy(false);
    const { fields, form } = splitApiError(res.error);
    setErrors(fields);
    setFormError(form);
    if (res.error.code === "INVALID_CREDENTIALS") {
      setPassword("");
      formRef.current?.querySelector<HTMLInputElement>('[name="password"]')?.focus();
    } else {
      focusFirstError(formRef.current, fields, ORDER);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      <Field
        label="Email or username"
        name="identifier"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={identifier}
        onChange={(e) => {
          setIdentifier(e.target.value);
          if (errors.identifier) setErrors((x) => without(x, "identifier"));
        }}
        error={errors.identifier}
      />
      <div className="space-y-1.5">
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((x) => without(x, "password"));
          }}
          error={errors.password}
        />
        <p className="text-right text-sm">
          <Link href="/forgot-password" className="font-bold text-lagoon-300 underline-offset-4 hover:underline">
            Forgot your password?
          </Link>
        </p>
      </div>

      {formError ? (
        <Notice tone="error" title="No luck this time">
          {formError}
        </Notice>
      ) : null}

      <Button type="submit" size="lg" loading={busy} className="w-full">
        {busy ? "Checking…" : "Sign in"}
      </Button>
    </form>
  );
}
