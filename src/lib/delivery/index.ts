import "server-only";
import { AppError } from "@/lib/api/errors";
import { env } from "@/lib/env";

export type DeliveryChannel = "EMAIL" | "SMS";

export interface CodeMessage {
  channel: DeliveryChannel;
  destination: string;
  purpose: string;
  code: string;
}

export interface DeliveryProvider {
  readonly id: string;
  /** True when codes go somewhere a real user would receive them. */
  readonly realDelivery: boolean;
  send(msg: CodeMessage): Promise<void>;
}

/**
 * Development-only delivery: prints codes to the SERVER console. Codes are never
 * returned over HTTP or logged client-side. Refused when NODE_ENV=production.
 */
export class ConsoleDeliveryProvider implements DeliveryProvider {
  readonly id = "console";
  readonly realDelivery = false;

  async send(msg: CodeMessage): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new AppError("DELIVERY_UNAVAILABLE", "Code delivery isn't configured on this server.");
    }
    console.info(
      `[gubbles:dev-delivery] channel=${msg.channel} to=${msg.destination} purpose=${msg.purpose} code=${msg.code} (development only — not sent)`,
    );
  }
}

let provider: DeliveryProvider | null = null;

export function deliveryProvider(): DeliveryProvider {
  if (provider) return provider;
  switch (env().DELIVERY_PROVIDER) {
    case "console":
      provider = new ConsoleDeliveryProvider();
      break;
  }
  return provider!;
}

/** Whether the UI should show the "development delivery" banner. */
export function isDevDelivery(): boolean {
  return !deliveryProvider().realDelivery;
}
