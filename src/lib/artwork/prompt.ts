import { ELEMENTS, FAMILIES, RARITIES, VARIANTS } from "@/lib/game/catalogue";
import type { ArtSpec } from "@/lib/game/types";
import { ARTWORK } from "@/lib/game/constants";

/**
 * Art prompt template (versioned). Built ONLY from fixed card attributes. The
 * provider illustrates; it never chooses traits or stats. No text, frames, logos
 * or QR codes in the image — the app renders all card furniture itself.
 */
export function buildArtPrompt(spec: ArtSpec): { prompt: string; version: string } {
  const fam = FAMILIES[spec.family];
  const el = ELEMENTS[spec.element];
  const variant = VARIANTS[spec.variant];
  const rarity = RARITIES[spec.rarity];
  const patternText = { none: "smooth", spots: "softly spotted", bands: "gently banded", stars: "star-speckled" }[spec.pattern];
  const eyes = { round: "big round curious eyes", sparkle: "big sparkling eyes", sleepy: "contented half-closed eyes" }[spec.eyes];
  const mood = { grin: "a cheeky grin", open: "an excited open-mouthed smile", smirk: "a mischievous smirk" }[spec.mouth];
  const prompt = [
    `Original character illustration of a single small creature called a Gubble: ${fam.artDirection}.`,
    `Personality: ${fam.personality}. Expression: ${eyes} and ${mood}.`,
    `Element: ${el.name.toLowerCase()} — set in ${el.habitat}, soft ambient ${el.name.toLowerCase()}-themed particles.`,
    `Colouring: ${patternText} body in a palette centred on hue ${spec.hue}° with accents near hue ${spec.accentHue}°; ${variant.name.toLowerCase()} lighting.`,
    rarity.id === "epic" || rarity.id === "mythic" ? "A subtle magical glow surrounds it." : "",
    "Style: polished, whimsical 3D-painted game art, soft rim light, centered full-body composition, square framing, gentle depth of field.",
    "Strictly no text, letters, numbers, logos, borders, card frames, UI elements, watermarks or QR codes. Do not imitate any existing franchise's characters or art style.",
  ]
    .filter(Boolean)
    .join(" ");
  return { prompt, version: ARTWORK.PROMPT_TEMPLATE_VERSION };
}
