import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordFlow } from "@/components/account/ForgotPasswordFlow";
import { Icon } from "@/components/icons";
import { DevDeliveryNotice } from "@/components/ui/notice";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sun-400/15 text-sun-300">
          <Icon.Key className="h-6 w-6" />
        </span>
        <p className="eyebrow">Password rescue</p>
        <h1 className="text-3xl font-bold text-ink">Forgot your password?</h1>
        <p className="text-muted">
          No shame — even Gubbles lose things (mostly socks). We&apos;ll email you a code so you can pick a new one.
        </p>
      </div>

      <DevDeliveryNotice />

      <ForgotPasswordFlow />

      <p className="text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/signin" className="font-bold text-sun-300 underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
