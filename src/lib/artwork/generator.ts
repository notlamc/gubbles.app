import "server-only";

/**
 * Creature illustration only — never card text, stats, frames or QR codes; the
 * app renders those as HTML/SVG. Input is derived from FIXED card attributes and
 * never contains the raw QR payload, location, or any account data.
 */
export interface ArtworkRequest {
  cardId: string;
  prompt: string;
  promptVersion: string;
  /** Fixed attributes (for deterministic generators such as the stub). */
  artSpecJson: string;
}

export interface ArtworkResult {
  bytes: Buffer;
  /** Reported by the provider; always re-checked by sniffing. */
  mime: string;
}

export interface ArtworkGenerator {
  /** Stable provider identifier persisted with each card, e.g. "openai" or "local-stub". */
  readonly provider: string;
  readonly model: string;
  /** True for AI providers; false for the deterministic stub (never presented as AI art). */
  readonly isAi: boolean;
  generate(req: ArtworkRequest, signal: AbortSignal): Promise<ArtworkResult>;
}

/** Error whose message is safe to persist privately (no secrets, no request bodies). */
export class ArtworkProviderError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "ArtworkProviderError";
  }
}
