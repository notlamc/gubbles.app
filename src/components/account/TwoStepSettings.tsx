"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client/api";
import { CodeField, CopyButton, PasswordField, StatusBadge, digitsOnly, splitApiError, without, type FieldErrors } from "./bits";

/**
 * Two-step verification (authenticator app / TOTP). Freshly issued recovery codes are held
 * here, above the on/off split, so a server refresh can't hide them before they're saved.
 */
export function TwoStepSettings({ enabled, recoveryCodesRemaining }: { enabled: boolean; recoveryCodesRemaining: number }) {
  const router = useRouter();
  const [pendingCodes, setPendingCodes] = useState<{ codes: string[]; reason: "enabled" | "regenerated" } | null>(null);
  const [flash, setFlash] = useState<string>();

  let body;
  if (pendingCodes) {
    body = (
      <RecoveryCodesReveal
        codes={pendingCodes.codes}
        step={pendingCodes.reason === "enabled" ? 4 : undefined}
        intro={
          pendingCodes.reason === "enabled"
            ? "Two-step verification is on! These recovery codes get you in if you ever lose your authenticator app."
            : "Your old recovery codes have stopped working. Here are fresh ones."
        }
        onDone={() => {
          setFlash(pendingCodes.reason === "enabled" ? "Two-step verification is on. Nicely done!" : "New recovery codes saved.");
          setPendingCodes(null);
          router.refresh();
        }}
      />
    );
  } else if (enabled) {
    body = (
      <TotpManage
        recoveryCodesRemaining={recoveryCodesRemaining}
        onRegenerated={(codes) => {
          setFlash(undefined);
          setPendingCodes({ codes, reason: "regenerated" });
        }}
        onDisabled={() => {
          setFlash("Two-step verification is off. You can turn it back on any time.");
          router.refresh();
        }}
      />
    );
  } else {
    body = (
      <TotpEnrol
        onActivated={(codes) => {
          setFlash(undefined);
          setPendingCodes({ codes, reason: "enabled" });
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div aria-live="polite">{flash ? <Notice tone="success" role="status">{flash}</Notice> : null}</div>
      {body}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Enrolment wizard
// ---------------------------------------------------------------------------

type EnrolStep = "intro" | "password" | "scan" | "verify";

function StepHeading({ step, title }: { step?: number; title: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="space-y-1">
      {step ? <p className="eyebrow">Step {step} of 4</p> : null}
      <h3 ref={ref} tabIndex={-1} className="text-lg font-semibold text-ink focus:outline-none focus-visible:outline-none">
        {title}
      </h3>
    </div>
  );
}

function TotpEnrol({ onActivated }: { onActivated: (codes: string[]) => void }) {
  const [step, setStep] = useState<EnrolStep>("intro");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string; qrSvg: string } | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    if (!password) return setError("Enter your password.");
    setBusy(true);
    const res = await api<{ secret: string; otpauthUri: string; qrSvg: string }>("/security/totp/setup", {
      method: "POST",
      json: { password },
    });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    setPassword("");
    setSetup(res.data);
    setStep("scan");
  }

  async function onVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    if (code.length !== 6) return setError("Enter the 6-digit code from your app.");
    setBusy(true);
    const res = await api<{ enabled: boolean; recoveryCodes: string[] }>("/security/totp/activate", { method: "POST", json: { code } });
    setBusy(false);
    if (!res.ok) {
      setCode("");
      return setError(res.error.message);
    }
    setSetup(null);
    onActivated(res.data.recoveryCodes);
  }

  if (step === "intro") {
    return (
      <div className="animate-fade-up space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge ok={false} okLabel="On" pendingLabel="Off" />
          <span className="text-sm text-muted">Two-step verification is currently off.</span>
        </div>
        <p className="text-sm text-muted">
          Add a second lock: after your password, you&apos;ll type a 6-digit code from an authenticator app (like 1Password,
          Google Authenticator or Authy). We don&apos;t use SMS for this — it&apos;s too easy to intercept.
        </p>
        <Button type="button" onClick={() => setStep("password")}>
          <Icon.Shield className="h-4 w-4" /> Turn on two-step
        </Button>
      </div>
    );
  }

  if (step === "password") {
    return (
      <form onSubmit={onPassword} noValidate className="animate-fade-up space-y-4">
        <StepHeading step={1} title="Confirm it's you" />
        <PasswordField
          label="Your password"
          name="totpPassword"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(undefined);
          }}
          error={error}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={busy}>
            Continue
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setPassword("");
              setError(undefined);
              setStep("intro");
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (step === "scan" && setup) {
    return (
      <div className="animate-fade-up space-y-4">
        <StepHeading step={2} title="Scan this with your authenticator app" />
        <Notice tone="warning" title="Shown only once">
          This QR code and secret won&apos;t be shown again. If you leave now, you&apos;ll need to start setup over.
        </Notice>
        <div className="flex justify-center">
          <div className="rounded-card bg-white p-3 shadow-lift">
            {/* eslint-disable-next-line @next/next/no-img-element -- inline data: SVG, no optimisation possible */}
            <img
              alt="Authenticator setup QR code"
              src={"data:image/svg+xml;utf8," + encodeURIComponent(setup.qrSvg)}
              width={220}
              height={220}
              className="h-[220px] w-[220px]"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <p id="totp-secret-label" className="text-sm font-bold text-muted">
            Can&apos;t scan? Enter this key instead
          </p>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/12 bg-night-950/60 p-3">
            <code aria-labelledby="totp-secret-label" className="min-w-0 flex-1 break-all font-mono text-base tracking-wider text-ink">
              {setup.secret.replace(/(.{4})/g, "$1 ").trim()}
            </code>
            <CopyButton text={setup.secret} label="Copy key" />
          </div>
          <a href={setup.otpauthUri} className="inline-block text-sm font-bold text-lagoon-300 underline-offset-4 hover:underline">
            On this phone? Open in your authenticator app
          </a>
        </div>
        <Button type="button" onClick={() => setStep("verify")}>
          I&apos;ve added it <Icon.Arrow className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onVerify} noValidate className="animate-fade-up space-y-4">
      <StepHeading step={3} title="Type the code your app shows" />
      <CodeField
        label="6-digit code"
        name="totpCode"
        value={code}
        onChange={(e) => {
          setCode(digitsOnly(e.target.value));
          setError(undefined);
        }}
        error={error}
        hint="Codes refresh every 30 seconds — any current one will do."
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy}>
          Turn it on
        </Button>
        <Button type="button" variant="ghost" onClick={() => setStep("scan")} disabled={!setup}>
          <Icon.Back className="h-4 w-4" /> Back to QR code
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Recovery codes (shown once)
// ---------------------------------------------------------------------------

function RecoveryCodesReveal({ codes, intro, step, onDone }: { codes: string[]; intro: string; step?: number; onDone: () => void }) {
  const text = codes.join("\n");

  function download() {
    const body = [
      "Gubbles recovery codes",
      `Generated ${new Date().toISOString()}`,
      "Each code works once. Keep them somewhere safe.",
      "",
      ...codes,
      "",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "gubbles-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="animate-fade-up space-y-4">
      <StepHeading step={step} title="Save your recovery codes" />
      <p className="text-sm text-muted">{intro}</p>
      <Notice tone="warning" title="You'll only see these once">
        Each code works a single time. Store them somewhere safe — a password manager is perfect.
      </Notice>
      <ol aria-label="Recovery codes" className="grid grid-cols-2 gap-2 rounded-2xl border border-white/12 bg-night-950/60 p-3">
        {codes.map((c) => (
          <li key={c} className="rounded-xl bg-white/5 px-2 py-2 text-center font-mono text-sm tracking-wider text-ink sm:text-base">
            {c}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={text} label="Copy all" />
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center gap-1.5 rounded-pill border border-white/15 bg-night-800/80 px-3 py-1.5 text-xs font-bold text-ink hover:bg-night-700"
        >
          <Icon.Upload className="h-3.5 w-3.5 rotate-180" /> Download .txt
        </button>
      </div>
      <Button type="button" onClick={onDone}>
        <Icon.Check className="h-4 w-4" /> I&apos;ve saved these
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manage (when on)
// ---------------------------------------------------------------------------

function TotpManage({
  recoveryCodesRemaining,
  onRegenerated,
  onDisabled,
}: {
  recoveryCodesRemaining: number;
  onRegenerated: (codes: string[]) => void;
  onDisabled: () => void;
}) {
  const low = recoveryCodesRemaining <= 3;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge ok okLabel="On" pendingLabel="Off" />
        <span className="text-sm text-muted">Signing in asks for a code from your authenticator app.</span>
      </div>
      <p className={`text-sm ${low ? "font-bold text-sun-200" : "text-muted"}`}>
        {low ? <Icon.Info className="mr-1 inline h-4 w-4 align-[-3px]" /> : null}
        {recoveryCodesRemaining} unused recovery {recoveryCodesRemaining === 1 ? "code" : "codes"} left.
        {low ? " Running low — consider generating a fresh set." : ""}
      </p>

      <details className="group rounded-2xl border border-white/10 bg-night-950/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl p-4 font-bold text-ink">
          <span className="inline-flex items-center gap-2">
            <Icon.Refresh className="h-4 w-4 text-lagoon-300" /> Generate new recovery codes
          </span>
          <span aria-hidden="true" className="text-muted transition group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="px-4 pb-4">
          <RegenerateForm onRegenerated={onRegenerated} />
        </div>
      </details>

      <details className="group rounded-2xl border border-danger-400/25 bg-night-950/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl p-4 font-bold text-danger-300">
          <span className="inline-flex items-center gap-2">
            <Icon.X className="h-4 w-4" /> Turn off two-step verification
          </span>
          <span aria-hidden="true" className="text-muted transition group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="px-4 pb-4">
          <DisableForm onDisabled={onDisabled} />
        </div>
      </details>
    </div>
  );
}

function RegenerateForm({ onRegenerated }: { onRegenerated: (codes: string[]) => void }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(undefined);
    const errs: FieldErrors = {};
    if (!password) errs.password = "Enter your password.";
    if (code.length !== 6) errs.code = "Enter the 6-digit code from your app.";
    if (Object.keys(errs).length) return setErrors(errs);
    setBusy(true);
    const res = await api<{ recoveryCodes: string[] }>("/security/totp/recovery-codes", { method: "POST", json: { password, code } });
    setBusy(false);
    if (res.ok) return onRegenerated(res.data.recoveryCodes);
    setCode("");
    const { fields, form } = splitApiError(res.error, { INVALID_CREDENTIALS: "password", INVALID_CODE: "code" });
    setErrors(fields);
    setFormError(form);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <p className="text-sm text-muted">Your current recovery codes will stop working immediately.</p>
      <PasswordField
        label="Your password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (errors.password) setErrors((x) => without(x, "password"));
        }}
        error={errors.password}
      />
      <CodeField
        label="Authenticator code"
        name="code"
        value={code}
        onChange={(e) => {
          setCode(digitsOnly(e.target.value));
          if (errors.code) setErrors((x) => without(x, "code"));
        }}
        error={errors.code}
      />
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <Button type="submit" variant="secondary" loading={busy}>
        Generate new codes
      </Button>
    </form>
  );
}

function DisableForm({ onDisabled }: { onDisabled: () => void }) {
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<"code" | "recovery">("code");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(undefined);
    const errs: FieldErrors = {};
    if (!password) errs.password = "Enter your password.";
    if (method === "code" && code.length !== 6) errs.code = "Enter the 6-digit code from your app.";
    if (method === "recovery" && recoveryCode.trim().length < 10) errs.recoveryCode = "Recovery codes look like abcde-12345.";
    if (Object.keys(errs).length) return setErrors(errs);
    setBusy(true);
    const res = await api<{ enabled: false }>("/security/totp/disable", {
      method: "POST",
      json: method === "code" ? { password, code } : { password, recoveryCode: recoveryCode.trim() },
    });
    setBusy(false);
    if (res.ok) return onDisabled();
    const target = method === "code" ? "code" : "recoveryCode";
    const { fields, form } = splitApiError(res.error, { INVALID_CREDENTIALS: "password", INVALID_CODE: target });
    setErrors(fields);
    setFormError(form);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <p className="text-sm text-muted">Your account will be protected by your password alone. Your recovery codes will be deleted.</p>
      <PasswordField
        label="Your password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (errors.password) setErrors((x) => without(x, "password"));
        }}
        error={errors.password}
      />
      {method === "code" ? (
        <CodeField
          label="Authenticator code"
          name="code"
          value={code}
          onChange={(e) => {
            setCode(digitsOnly(e.target.value));
            if (errors.code) setErrors((x) => without(x, "code"));
          }}
          error={errors.code}
        />
      ) : (
        <Field
          label="Recovery code"
          name="recoveryCode"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="abcde-12345"
          value={recoveryCode}
          onChange={(e) => {
            setRecoveryCode(e.target.value);
            if (errors.recoveryCode) setErrors((x) => without(x, "recoveryCode"));
          }}
          error={errors.recoveryCode}
          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
        />
      )}
      <button
        type="button"
        onClick={() => {
          setMethod((m) => (m === "code" ? "recovery" : "code"));
          setErrors((x) => without(without(x, "code"), "recoveryCode"));
        }}
        className="rounded-pill px-2 py-1 text-sm font-bold text-lagoon-300 hover:bg-white/5"
      >
        {method === "code" ? "No authenticator? Use a recovery code" : "Use an authenticator code instead"}
      </button>
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <div>
        <Button type="submit" variant="danger" loading={busy}>
          Turn off two-step
        </Button>
      </div>
    </form>
  );
}
