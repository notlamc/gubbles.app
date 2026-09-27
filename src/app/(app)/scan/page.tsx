import type { Metadata } from "next";
import { ScanFlow } from "@/components/game/ScanFlow";
import { requirePageUser } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { dailyUsage } from "@/lib/game/daily";
import { utcDay } from "@/lib/game/day";

export const metadata: Metadata = { title: "Scan" };

export default async function ScanPage() {
  const { user } = await requirePageUser({ requireConfirmed: true });
  const usage = await dailyUsage(db, user.id, utcDay());
  const left = Math.max(0, usage.discoveryCap - usage.discoveries);
  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <p className="eyebrow">Discovery</p>
        <h1 className="mt-2 font-display text-4xl font-bold">Who&apos;s hiding in there?</h1>
        <p className="mt-1 text-muted">
          {left > 0 ? (
            <>You can find <strong className="text-ink">{left}</strong> more new Gubble{left === 1 ? "" : "s"} today. Re-scanning today&apos;s codes is free.</>
          ) : (
            <>You&apos;ve found today&apos;s quota of new Gubbles — re-scans of today&apos;s codes still work. New ones appear after midnight UTC.</>
          )}
        </p>
      </header>
      <ScanFlow />
    </div>
  );
}
