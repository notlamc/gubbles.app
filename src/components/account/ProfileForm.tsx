"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { api } from "@/lib/client/api";
import { DisplayNameSchema, PublicHandleSchema } from "@/lib/validation";
import { focusFirstError, splitApiError, without, zodFieldErrors, type FieldErrors } from "./bits";

const Schema = z.object({ displayName: DisplayNameSchema, publicHandle: PublicHandleSchema });
const ORDER = ["displayName", "publicHandle"];

export function ProfileForm({
  displayName: initialName,
  publicHandle: initialHandle,
  ownerIsPublic: initialPublic,
}: {
  displayName: string;
  publicHandle: string | null;
  ownerIsPublic: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [displayName, setDisplayName] = useState(initialName);
  const [publicHandle, setPublicHandle] = useState(initialHandle ?? "");
  const [ownerIsPublic, setOwnerIsPublic] = useState(initialPublic);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const dirty = displayName !== initialName || publicHandle !== (initialHandle ?? "") || ownerIsPublic !== initialPublic;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(undefined);
    setSaved(false);
    const check = Schema.safeParse({ displayName, publicHandle });
    if (!check.success) {
      const errs = zodFieldErrors(check.error);
      setErrors(errs);
      focusFirstError(formRef.current, errs, ORDER);
      return;
    }
    setBusy(true);
    const res = await api<{ account: unknown }>("/account/profile", {
      method: "PATCH",
      json: { displayName, publicHandle, ownerIsPublic },
    });
    setBusy(false);
    if (res.ok) {
      setErrors({});
      setSaved(true);
      router.refresh();
      return;
    }
    const { fields, form } = splitApiError(res.error, { HANDLE_TAKEN: "publicHandle" });
    setErrors(fields);
    setFormError(form);
    focusFirstError(formRef.current, fields, ORDER);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      <Field
        label="Display name"
        name="displayName"
        autoComplete="nickname"
        maxLength={40}
        value={displayName}
        onChange={(e) => {
          setDisplayName(e.target.value);
          setSaved(false);
          if (errors.displayName) setErrors((x) => without(x, "displayName"));
        }}
        error={errors.displayName}
        hint="What other explorers see. Up to 40 characters."
      />
      <Field
        label="Public handle"
        name="publicHandle"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={20}
        value={publicHandle}
        onChange={(e) => {
          setPublicHandle(e.target.value.replace(/^@/, ""));
          setSaved(false);
          if (errors.publicHandle) setErrors((x) => without(x, "publicHandle"));
        }}
        error={errors.publicHandle}
        hint="Your @name on public card pages. 3–20 letters, numbers or underscores."
      />

      <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-night-950/40 p-4">
        <div className="min-w-0">
          <p id="owner-public-label" className="font-bold text-ink">
            Show me as owner on public verification pages
          </p>
          <p id="owner-public-desc" className="mt-1 text-sm text-muted">
            Anyone can check a card is genuine. When this is off, those pages say &ldquo;Owner is private&rdquo; instead of your
            name and handle.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={ownerIsPublic}
          aria-labelledby="owner-public-label"
          aria-describedby="owner-public-desc"
          onClick={() => {
            setOwnerIsPublic((v) => !v);
            setSaved(false);
          }}
          className={`relative mt-1 inline-flex h-8 w-16 shrink-0 items-center rounded-pill border transition-colors ${
            ownerIsPublic ? "border-mint-400/60 bg-mint-400/30" : "border-white/15 bg-night-800"
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-1 h-6 w-6 rounded-full bg-ink shadow transition-[left] ${ownerIsPublic ? "left-9" : "left-1"}`}
          />
          <span aria-hidden="true" className={`absolute text-[0.65rem] font-bold ${ownerIsPublic ? "left-2 text-mint-300" : "right-2 text-faint"}`}>
            {ownerIsPublic ? "ON" : "OFF"}
          </span>
        </button>
      </div>

      {formError ? <Notice tone="error">{formError}</Notice> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy} disabled={!dirty && !busy}>
          Save profile
        </Button>
        <p aria-live="polite" className="text-sm font-bold text-mint-300">
          {saved ? "Saved ✓ Looking sharp." : ""}
        </p>
      </div>
    </form>
  );
}
