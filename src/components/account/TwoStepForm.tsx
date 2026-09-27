"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/client/api";
import { CodeField, digitsOnly } from "./bits";

type Mode = "code" | "recovery";

export function TwoStepForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<Mode>("code");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(undefined);
    // Wait for the new input to render, then focus it.
    window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>("input")?.focus());
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    if (mode === "code" && code.length !== 6) return setError("Enter the 6-digit code from your authenticator app.");
    if (mode === "recovery" && recoveryCode.trim().length < 10) return setError("Recovery codes look like abcde-12345.");
    setBusy(true);
    const res = await api<{ ok: boolean; next: string }>("/auth/signin/mfa", {
      method: "POST",
      json: mode === "code" ? { code } : { recoveryCode: recoveryCode.trim() },
    });
    if (res.ok) {
      router.replace("/play");
      router.refresh();
      return;
    }
    setBusy(false);
    if (res.error.code === "UNAUTHENTICATED") {
      router.replace("/signin?expired=1");
      return;
    }
    setError(res.error.fields ? Object.values(res.error.fields)[0]?.[0] ?? res.error.message : res.error.message);
    if (mode === "code") setCode("");
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      <div key={mode} className="animate-fade-up">
        {mode === "code" ? (
          <CodeField
            label="Authenticator code"
            name="code"
            autoFocus
            value={code}
            onChange={(e) => setCode(digitsOnly(e.target.value))}
            error={error}
            hint="Open your authenticator app and type the 6 digits shown for Gubbles."
          />
        ) : (
          <Field
            label="Recovery code"
            name="recoveryCode"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            error={error}
            placeholder="abcde-12345"
            hint="One of the codes you saved when you turned on two-step. Each works once."
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          />
        )}
      </div>

      <Button type="submit" size="lg" loading={busy} className="w-full">
        {busy ? "Verifying…" : "Verify and continue"}
      </Button>

      <div className="flex flex-col items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => switchMode(mode === "code" ? "recovery" : "code")}
          className="rounded-pill px-3 py-1.5 font-bold text-lagoon-300 hover:bg-white/5"
        >
          {mode === "code" ? "Lost your phone? Use a recovery code" : "Use my authenticator app instead"}
        </button>
        <Link href="/signin" className="rounded-pill px-3 py-1.5 font-bold text-muted hover:bg-white/5 hover:text-ink">
          Start over
        </Link>
      </div>
    </form>
  );
}
