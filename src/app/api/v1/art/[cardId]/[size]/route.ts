import { errorResponse } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { assetStorage } from "@/lib/artwork/storage";
import { artAssetKey } from "@/lib/cards/service";

export const runtime = "nodejs";

/** Stable, controlled URL for a card's generated creature art. Content is immutable once ready. */
export async function GET(_req: Request, { params }: { params: Promise<{ cardId: string; size: string }> }) {
  try {
    const { cardId, size } = await params;
    if (size !== "display" && size !== "thumb") throw new AppError("NOT_FOUND", "Not found.");
    const asset = await artAssetKey(cardId, size);
    if (!asset) throw new AppError("NOT_FOUND", "Artwork isn't ready.");
    const bytes = await assetStorage().get(asset.key);
    if (!bytes) throw new AppError("NOT_FOUND", "Artwork isn't available.");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: `"${asset.hash.slice(0, 32)}-${size}"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
