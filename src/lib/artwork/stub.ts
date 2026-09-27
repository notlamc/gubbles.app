import "server-only";
import sharp from "sharp";
import { renderCreatureSvg } from "@/lib/art/creature-svg";
import { parseArtSpec } from "@/lib/game/types";
import type { ArtworkGenerator, ArtworkRequest, ArtworkResult } from "./generator";

/**
 * Deterministic local stand-in for an image provider. It rasterizes the
 * code-rendered preview art at high resolution with a "studio" backdrop. It is
 * NOT AI output and the UI labels it as such.
 *
 * For tests, failures can be injected with `failTimes` (per card id).
 */
export class StubArtworkGenerator implements ArtworkGenerator {
  readonly provider = "local-stub";
  readonly model = "gubbles-svg-v1";
  readonly isAi = false;
  private readonly failures = new Map<string, number>();

  constructor(private readonly opts: { failTimes?: (cardId: string) => number; delayMs?: number } = {}) {}

  async generate(req: ArtworkRequest, signal: AbortSignal): Promise<ArtworkResult> {
    if (this.opts.delayMs) await new Promise((r) => setTimeout(r, this.opts.delayMs));
    signal.throwIfAborted();
    const allowedFailures = this.opts.failTimes?.(req.cardId) ?? 0;
    const seen = this.failures.get(req.cardId) ?? 0;
    if (seen < allowedFailures) {
      this.failures.set(req.cardId, seen + 1);
      const { ArtworkProviderError } = await import("./generator");
      throw new ArtworkProviderError("stub: injected failure", true);
    }
    const svg = renderCreatureSvg(parseArtSpec(req.artSpecJson));
    const bytes = await sharp(Buffer.from(svg), { density: 288 }).resize(1024, 1024).png().toBuffer();
    return { bytes, mime: "image/png" };
  }
}
