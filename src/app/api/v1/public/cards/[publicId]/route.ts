import { AppError } from "@/lib/api/errors";
import { json, route } from "@/lib/api/handler";
import { getPublicVerification } from "@/lib/cards/service";
import { RATE_LIMITS } from "@/lib/game/constants";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";

export const runtime = "nodejs";

/** Public, unauthenticated, live ownership lookup. Never includes location, QR payload or contact data. */
export const GET = route(async (req, { params }: { params: Promise<{ publicId: string }> }) => {
  await consumeRateLimit(`verify:ip:${clientIp(req)}`, RATE_LIMITS.publicVerifyPerIp);
  const { publicId } = await params;
  const v = await getPublicVerification(publicId);
  if (!v) throw new AppError("NOT_FOUND", "No Gubbles card has that verification ID.");
  const { card, owner, retrievedAt } = v;
  return json(
    {
      card: {
        id: card.id,
        name: card.name,
        family: card.family,
        element: card.element,
        role: card.role,
        rarity: card.rarity,
        variant: card.variant,
        stats: card.stats,
        traits: card.traits,
        cardNumber: card.cardNumber,
        mintedAt: card.mintedAt,
        art: { status: card.art.status, url: card.art.url },
      },
      currentOwner: owner.isPublic ? { handle: owner.handle, displayName: owner.displayName } : { private: true },
      ownershipRetrievedAt: retrievedAt,
      disclaimer:
        "Confirms this card record exists in Gubbles and names its current in-app owner at lookup time. It does not authenticate printed cards, physical possession, real-world identity or off-platform sales.",
    },
    { headers: { "X-Robots-Tag": "noindex, nofollow" } },
  );
});
