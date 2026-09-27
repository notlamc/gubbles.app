import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TwoStepForm } from "@/components/account/TwoStepForm";
import { Icon } from "@/components/icons";
import { currentSession } from "@/lib/auth/context";

export const metadata: Metadata = { title: "Two-step verification" };

export default async function TwoStepPage() {
  const session = await currentSession();
  if (!session || session.stage !== "MFA_PENDING") redirect("/signin");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lagoon-400/15 text-lagoon-300">
          <Icon.Shield className="h-6 w-6" />
        </span>
        <p className="eyebrow">One more step</p>
        <h1 className="text-3xl font-bold text-ink">Prove it&apos;s really you</h1>
        <p className="text-muted">Your password checked out. Now for the secret handshake from your authenticator app.</p>
      </div>
      <TwoStepForm />
    </div>
  );
}
