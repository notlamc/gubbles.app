import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SigninForm } from "@/components/account/SigninForm";
import { Notice } from "@/components/ui/notice";
import { currentUser } from "@/lib/auth/context";

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SigninPage({ searchParams }: { searchParams: SearchParams }) {
  if (await currentUser()) redirect("/play");
  const sp = await searchParams;
  const flag = (k: string) => sp[k] === "1";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="eyebrow">Welcome back</p>
        <h1 className="text-3xl font-bold text-ink">The Gubbles missed you</h1>
        <p className="text-muted">Sign in to pick up where you left off.</p>
      </div>

      <div className="space-y-3" aria-live="polite">
        {flag("signedOut") ? (
          <Notice tone="success" title="You're signed out" role="status">
            See you soon — the Gubbles promise not to wander off. (Much.)
          </Notice>
        ) : null}
        {flag("reset") ? (
          <Notice tone="success" title="Password updated" role="status">
            Sign in with your new password. For safety, every device was signed out.
          </Notice>
        ) : null}
        {flag("expired") ? (
          <Notice tone="warning" title="Your session expired" role="status">
            It happens to the best of us. Sign in again to keep exploring.
          </Notice>
        ) : null}
      </div>

      <SigninForm />

      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-bold text-sun-300 underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
