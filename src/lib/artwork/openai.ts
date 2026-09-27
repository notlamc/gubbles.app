import "server-only";
import { ArtworkProviderError, type ArtworkGenerator, type ArtworkRequest, type ArtworkResult } from "./generator";

/**
 * OpenAI Images adapter (server-side only). Configure with ARTWORK_PROVIDER=openai,
 * ARTWORK_MODEL and OPENAI_API_KEY. Only the art prompt is sent — never QR payloads,
 * locations or account data. Errors are sanitized before persistence.
 */
export class OpenAiArtworkGenerator implements ArtworkGenerator {
  readonly provider = "openai";
  readonly isAi = true;

  constructor(private readonly apiKey: string, readonly model: string) {}

  async generate(req: ArtworkRequest, signal: AbortSignal): Promise<ArtworkResult> {
    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        signal,
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, prompt: req.prompt, n: 1, size: "1024x1024", user: `card-${req.cardId}` }),
      });
    } catch (err) {
      const aborted = err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
      throw new ArtworkProviderError(aborted ? "provider timeout" : "provider network error", true);
    }
    if (!res.ok) {
      // Never persist the response body verbatim; keep status and a coarse category.
      const retryable = res.status === 429 || res.status >= 500;
      throw new ArtworkProviderError(`provider HTTP ${res.status}`, retryable);
    }
    const json = (await res.json().catch(() => null)) as { data?: { b64_json?: string; url?: string }[] } | null;
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new ArtworkProviderError("provider returned no image data", true);
    return { bytes: Buffer.from(b64, "base64"), mime: "image/png" };
  }
}
