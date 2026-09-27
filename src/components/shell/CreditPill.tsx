import { Icon } from "@/components/icons";

/** Demo credit is non-purchasable and has no monetary value — the label says so. */
export function CreditPill({ balance }: { balance: number }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-pill border border-sun-400/40 bg-sun-400/10 px-3 py-1.5 text-sm font-bold text-sun-200"
      title="Demo credit — free, non-purchasable, no monetary value"
    >
      <Icon.Coin className="h-4 w-4 text-sun-400" />
      <span>{balance}</span>
      <span className="text-xs font-semibold text-sun-200/80">demo credit</span>
    </span>
  );
}
