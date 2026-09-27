import { vi } from "vitest";
import { ConsoleDeliveryProvider, type CodeMessage } from "@/lib/delivery";

// Keep dev-delivery console output out of test logs.
vi.spyOn(console, "info").mockImplementation(() => undefined);

// Capture every code the console provider would print (server-side only in real use).
export const SENT_CODES: CodeMessage[] = [];
const original = ConsoleDeliveryProvider.prototype.send;
ConsoleDeliveryProvider.prototype.send = async function (msg: CodeMessage) {
  await original.call(this, msg); // keeps the production refusal behaviour
  SENT_CODES.push(msg);
};
(globalThis as { __SENT_CODES__?: CodeMessage[] }).__SENT_CODES__ = SENT_CODES;
