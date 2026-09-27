"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { api } from "@/lib/client/api";
import { AUTH } from "@/lib/game/constants";
import { PasswordSchema } from "@/lib/validation";
import { PasswordField, focusFirstError, splitApiError, without, type FieldErrors } from "./bits";

const ORDER = ["currentPassword", "newPassword"];

export function ChangePasswordForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(undefined);
    setDone(false);
    const errs: FieldErrors = {};
    if (!currentPassword) errs.currentPassword = "Enter your current password.";
    const pw = PasswordSchema.safeParse(newPassword);
    if (!pw.success) errs.newPassword = pw.error.issues[0]?.message ?? "Choose a longer password.";
    else if (newPassword === currentPassword) errs.newPassword = "Pick something different from your current password.";
    if (Object.keys(errs).length) {
      setErrors(errs);
      focusFirstError(formRef.current, errs, ORDER);
      return;
    }
    setBusy(true);
    const res = await api<{ ok: boolean }>("/security/password", { method: "POST", json: { currentPassword, newPassword } });
    setBusy(false);
    if (res.ok) {
      setCurrent("");
      setNew("");
      setErrors({});
      setDone(true);
      router.refresh();
      return;
    }
    const { fields, form } = splitApiError(res.error, { INVALID_CREDENTIALS: "currentPassword" });
    setErrors(fields);
    setFormError(form);
    focusFirstError(formRef.current, fields, ORDER);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      <PasswordField
        label="Current password"
        name="currentPassword"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(e) => {
          setCurrent(e.target.value);
          if (errors.currentPassword) setErrors((x) => without(x, "currentPassword"));
        }}
        error={errors.currentPassword}
      />
      <PasswordField
        label="New password"
        name="newPassword"
        autoComplete="new-password"
        minLength={AUTH.PASSWORD_MIN}
        maxLength={AUTH.PASSWORD_MAX}
        value={newPassword}
        onChange={(e) => {
          setNew(e.target.value);
          if (errors.newPassword) setErrors((x) => without(x, "newPassword"));
        }}
        error={errors.newPassword}
        hint={`At least ${AUTH.PASSWORD_MIN} characters.`}
      />
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <div aria-live="polite">
        {done ? (
          <Notice tone="success" title="Password changed">
            All your other devices have been signed out. This one stays signed in.
          </Notice>
        ) : null}
      </div>
      <Button type="submit" loading={busy}>
        Change password
      </Button>
    </form>
  );
}
