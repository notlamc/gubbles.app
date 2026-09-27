import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/account/SignupForm";
import { Icon } from "@/components/icons";
import { currentUser } from "@/lib/auth/context";
import { GAME } from "@/lib/game/constants";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage() {
  if (await currentUser()) redirect("/play");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="eyebrow">New explorer</p>
        <h1 className="text-3xl font-bold text-ink">Join the hunt</h1>
        <p className="text-muted">
          Gubbles are mischievous little creatures hiding inside QR codes all around you. Make an account and start catching
          them.
        </p>
      </div>

      <div className="flex gap-3 rounded-2xl border border-sun-400/30 bg-sun-400/10 p-4 text-sm">
        <Icon.Coin className="mt-0.5 h-5 w-5 shrink-0 text-sun-400" />
        <p className="text-sun-200">
          <strong className="font-bold">You start with {GAME.STARTING_DEMO_CREDIT} free demo credit.</strong>{" "}
          <span className="text-ink/85">
            It&apos;s play money for this prototype only — it can&apos;t be bought, sold or swapped, and it has no monetary value.
          </span>
        </p>
      </div>

      <SignupForm />

      <p className="text-center text-sm text-muted">
        Already a Gubble hunter?{" "}
        <Link href="/signin" className="font-bold text-sun-300 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
