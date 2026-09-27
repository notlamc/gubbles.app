import type { ReactNode } from "react";
import { Icon } from "@/components/icons";

type Tone = "info" | "success" | "warning" | "error" | "dev";

const tones: Record<Tone, string> = {
  info: "border-lagoon-400/30 bg-lagoon-400/10 text-lagoon-300",
  success: "border-mint-400/30 bg-mint-400/10 text-mint-300",
  warning: "border-sun-400/30 bg-sun-400/10 text-sun-200",
  error: "border-danger-400/40 bg-danger-400/10 text-danger-300",
  dev: "border-dashed border-lilac-400/50 bg-lilac-400/10 text-lilac-300",
};

export function Notice({ tone = "info", title, children, role }: { tone?: Tone; title?: string; children?: ReactNode; role?: "alert" | "status" }) {
  return (
    <div role={role ?? (tone === "error" ? "alert" : undefined)} className={`flex gap-3 rounded-2xl border px-4 py-3 text-sm ${tones[tone]}`}>
      <Icon.Info className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-0.5">
        {title ? <p className="font-bold">{title}</p> : null}
        {children ? <div className="text-ink/85">{children}</div> : null}
      </div>
    </div>
  );
}

/** Shown wherever codes are "sent" while only the development console provider is configured. */
export function DevDeliveryNotice() {
  return (
    <Notice tone="dev" title="Development delivery">
      No real email or SMS is sent in this proof of concept. Codes are printed to the <strong>server console</strong> only
      (look for <code className="rounded bg-night-950/60 px-1">[gubbles:dev-delivery]</code>).
    </Notice>
  );
}
