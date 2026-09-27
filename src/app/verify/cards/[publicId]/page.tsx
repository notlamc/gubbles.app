import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { GubbleCard } from "@/components/card/GubbleCard";
import { Icon } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { isAppError } from "@/lib/api/errors";
import { getPublicVerification } from "@/lib/cards/service";
import { RATE_LIMITS } from "@/lib/game/constants";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";

// Live database read on every request — never a cached/static snapshot.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Card verification", robots: { index: false, follow: false } };

export default async function VerifyCardPage(props: PageProps<"/verify/cards/[publicId]">) {
  const { publicId } = await props.params;
  const h = await headers();
  try {
    await consumeRateLimit(`verify:ip:${clientIp(new Request("http://local", { headers: h }))}`, RATE_LIMITS.publicVerifyPerIp);
  } catch (err) {
    if (isAppError(err) && err.code === "RATE_LIMITED") {
      return (
        <Shell>
          <Notice tone="warning" title="Too many lookups">Please wait a minute and try again.</Notice>
        </Shell>
      );
    }
    throw err;
  }
  const v = await getPublicVerification(publicId);
  if (!v) notFound();
  const { card, owner, retrievedAt } = v;

  return (
    <Shell>
      <div className="grid gap-8 md:grid-cols-[380px_1fr]">
        <div className="mx-auto w-full max-w-[380px]">
          <GubbleCard face={card} minted={card} size="detail" />
        </div>
        <div className="space-y-4">
          <div className="panel p-5">
            <p className="flex items-center gap-2 font-display text-lg font-bold text-mint-300">
              <Icon.Check className="h-5 w-5" /> This card exists in Gubbles
            </p>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-faint">Current owner</dt>
                <dd className="mt-0.5 font-display text-2xl font-bold" data-testid="current-owner">
                  {owner.isPublic ? (
                    <>
                      {owner.displayName} <span className="text-base text-muted">@{owner.handle}</span>
                    </>
                  ) : (
                    "Owner is private"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-faint">Ownership checked</dt>
                <dd className="font-bold">
                  <time dateTime={retrievedAt}>{new Date(retrievedAt).toUTCString()}</time>
                </dd>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-faint">Card</dt>
                  <dd className="font-bold">
                    {card.name} · {card.rarity.name} {card.element.name} {card.role.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-faint">Card number</dt>
                  <dd className="font-bold">{card.cardNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-faint">Card ID</dt>
                  <dd className="break-all font-mono text-sm font-bold">{card.id}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-faint">Minted</dt>
                  <dd className="font-bold">{new Date(card.mintedAt).toUTCString()}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-bold uppercase tracking-wider text-faint">Traits</dt>
                  <dd className="font-bold">{card.traits.map((t) => t.name).join(" · ")}</dd>
                </div>
              </div>
            </dl>
          </div>
          <Notice tone="info" title="What this page proves">
            It confirms this card record exists in Gubbles and names its current in-app owner at the moment shown above. It does
            not authenticate a printed card, physical possession, anyone&apos;s real-world identity, or a sale made outside Gubbles.
            A screenshot of this page isn&apos;t proof of current ownership — scan the card&apos;s QR again for a live check. Copying the
            QR code gives nobody control of the card.
          </Notice>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 py-6">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" aria-label="Gubbles home" className="rounded-xl">
          <Logo size="md" />
        </Link>
        <span className="rounded-pill border border-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted">Public verification</span>
      </header>
      <main id="main">
        <h1 className="sr-only">Gubbles card verification</h1>
        {children}
      </main>
    </div>
  );
}
