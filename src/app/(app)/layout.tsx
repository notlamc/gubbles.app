import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { CreditPill } from "@/components/shell/CreditPill";
import { DesktopNav, MobileTabBar } from "@/components/shell/NavLinks";
import { requirePageUser } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

/** Authenticated game shell. Each page also enforces auth itself (layouts don't guard data). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requirePageUser();
  return (
    <div className="min-h-dvh pb-28 md:pb-12">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-night-950/75 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/play" aria-label="Gubbles home" className="rounded-xl">
            <Logo size="md" />
          </Link>
          <DesktopNav />
          <CreditPill balance={user.creditBalance} />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 pt-6">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
