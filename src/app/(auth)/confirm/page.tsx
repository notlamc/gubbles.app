import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmChannels } from "@/components/account/ConfirmChannels";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { DevDeliveryNotice } from "@/components/ui/notice";
import { requirePageUser } from "@/lib/auth/context";

export const metadata: Metadata = { title: "Confirm your details" };

export default async function ConfirmPage() {
  const { user } = await requirePageUser();
  const emailConfirmed = Boolean(user.emailConfirmedAt);
  const phoneConfirmed = Boolean(user.phoneConfirmedAt);
  const allDone = emailConfirmed && phoneConfirmed;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="eyebrow">{allDone ? "Confirmed" : "Almost there"}</p>
        <h1 className="text-3xl font-bold text-ink">{allDone ? "Welcome aboard!" : "Check your codes"}</h1>
        {allDone ? null : (
          <p className="text-muted">
            We sent a 6-digit code to your email and another to your phone. Pop them in below so we know you&apos;re you —
            then the hunt begins.
          </p>
        )}
      </div>

      {allDone ? null : <DevDeliveryNotice />}

      <ConfirmChannels email={user.email} phone={user.phone} emailConfirmed={emailConfirmed} phoneConfirmed={phoneConfirmed} />

      {allDone ? null : (
        <div className="space-y-2 text-center text-sm text-muted">
          <p>
            Spotted a typo? Fix it from your{" "}
            <Link href="/profile" className="font-bold text-lagoon-300 underline-offset-4 hover:underline">
              profile
            </Link>
            .
          </p>
          <SignOutButton />
        </div>
      )}
    </div>
  );
}
