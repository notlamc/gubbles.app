import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AUTH } from "@/lib/game/constants";

export const metadata: Metadata = { title: "Proof-of-concept terms" };

function Term({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="eyebrow">The small print (kept small)</p>
        <h1 className="text-3xl font-bold text-ink">Proof-of-concept terms</h1>
        <p className="text-sm text-faint">Version {AUTH.TERMS_VERSION}</p>
        <p className="text-muted">
          Gubbles is an experiment. Here&apos;s exactly what that means for you, in plain words.
        </p>
      </header>

      <Term title="Demo credit is pretend money">
        <p>
          Every account gets free demo credit to play with. It can&apos;t be bought, sold, transferred, withdrawn or
          exchanged for anything, and it has <strong className="text-ink">no monetary value</strong>. It exists only so the
          game can be tested.
        </p>
      </Term>

      <Term title="No payments, marketplace or blockchain">
        <p>
          There are no payments of any kind, no marketplace, no NFTs and no blockchain. Cards live in our database and nowhere
          else.
        </p>
      </Term>

      <Term title="Location is a rough, unverified claim">
        <p>
          When you allow it, your browser tells us roughly where you are. We can&apos;t verify that claim. We round it to a
          cell about 1 km across and store only that cell — your exact coordinates are never stored.
        </p>
      </Term>

      <Term title="Codes in development builds">
        <p>
          Development builds don&apos;t send real emails or text messages. Verification and reset codes are printed to the
          server console instead.
        </p>
      </Term>

      <Term title="Things may be reset">
        <p>
          During the proof of concept, cards and their artwork may be changed or reset without notice. Please
          don&apos;t get <em>too</em> attached to your Gubbles.
        </p>
      </Term>

      <Term title="Not available (yet)">
        <p>Trading and battles are not part of this proof of concept.</p>
      </Term>

      <Term title="Play nicely">
        <p>
          Don&apos;t abuse the service, try to break other people&apos;s accounts, or scan things you shouldn&apos;t.
        </p>
      </Term>

      <p className="border-t border-white/10 pt-4 text-center text-sm text-muted">
        <Link href="/signup" className="font-bold text-sun-300 underline-offset-4 hover:underline">
          Create an account
        </Link>{" "}
        ·{" "}
        <Link href="/signin" className="font-bold text-sun-300 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </article>
  );
}
