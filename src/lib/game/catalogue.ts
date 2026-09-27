/**
 * Gubbles content catalogue, ruleset "gubbles-v1".
 *
 * This file is game data, not presentation. It is versioned with the ruleset:
 * changing any id, weight, cost or list order changes generated cards, so it
 * requires a new RULESET_ID (see constants.ts) and must never be edited in place
 * once cards exist for that ruleset.
 */

export const ELEMENT_IDS = ["tide", "gale", "ember", "grove"] as const;
export type ElementId = (typeof ELEMENT_IDS)[number];

export const ROLE_IDS = ["striker", "warden", "skirmisher"] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export const RARITY_IDS = ["common", "uncommon", "rare", "epic", "mythic"] as const;
export type RarityId = (typeof RARITY_IDS)[number];

export const FAMILY_IDS = ["ripplekin", "flurri", "brimmo", "mosslet", "shardling", "nyxen"] as const;
export type FamilyId = (typeof FAMILY_IDS)[number];

export const VARIANT_IDS = ["dawn", "dusk", "moonlit", "speckled", "banded", "starry"] as const;
export type VariantId = (typeof VARIANT_IDS)[number];

export type StatKey = "power" | "guard" | "speed";

export interface ElementDef {
  id: ElementId;
  name: string;
  habitat: string;
  /** Base hue for preview art. */
  hue: number;
}

export const ELEMENTS: Record<ElementId, ElementDef> = {
  tide: { id: "tide", name: "Tide", habitat: "tide pools", hue: 195 },
  gale: { id: "gale", name: "Gale", habitat: "cliff-top breezes", hue: 250 },
  ember: { id: "ember", name: "Ember", habitat: "warm chimney stones", hue: 18 },
  grove: { id: "grove", name: "Grove", habitat: "mossy hollows", hue: 110 },
};

export interface RoleDef {
  id: RoleId;
  name: string;
  primary: StatKey;
  secondary: StatKey;
  tertiary: StatKey;
  /** Share of the stat budget for each stat, in percent [min, max]. */
  shares: Record<StatKey, readonly [number, number]>;
  blurb: string;
}

/** Every role has the same base budget; traits spend part of it. Rarity never changes it. */
export const STAT_BUDGET = 150;
export const STAT_MIN = 15;
export const STAT_MAX = 80;

export const ROLES: Record<RoleId, RoleDef> = {
  striker: {
    id: "striker",
    name: "Striker",
    primary: "power",
    secondary: "speed",
    tertiary: "guard",
    shares: { power: [40, 50], speed: [24, 34], guard: [20, 30] },
    blurb: "Leans into Power. Built to make the first big splash.",
  },
  warden: {
    id: "warden",
    name: "Warden",
    primary: "guard",
    secondary: "power",
    tertiary: "speed",
    shares: { guard: [40, 50], power: [24, 34], speed: [20, 30] },
    blurb: "Leans into Guard. Holds the line and looks after friends.",
  },
  skirmisher: {
    id: "skirmisher",
    name: "Skirmisher",
    primary: "speed",
    secondary: "power",
    tertiary: "guard",
    shares: { speed: [40, 50], power: [24, 34], guard: [20, 30] },
    blurb: "Leans into Speed. Darts in, darts out, grins about it.",
  },
};

export interface RarityDef {
  id: RarityId;
  name: string;
  /** Integer weight out of the rarity table total. Rarity affects visuals only. */
  weight: number;
}

export const RARITIES: Record<RarityId, RarityDef> = {
  common: { id: "common", name: "Common", weight: 600 },
  uncommon: { id: "uncommon", name: "Uncommon", weight: 250 },
  rare: { id: "rare", name: "Rare", weight: 100 },
  epic: { id: "epic", name: "Epic", weight: 40 },
  mythic: { id: "mythic", name: "Mythic", weight: 10 },
};

export interface FamilyDef {
  id: FamilyId;
  number: number;
  name: string;
  code: string;
  nativeElement: ElementId;
  roles: readonly RoleId[];
  silhouette: string;
  personality: string;
  /** Flavour templates; "{habitat}" is replaced by the element habitat. */
  flavours: readonly string[];
  /** Art-direction reference for the image provider (no gameplay content). */
  artDirection: string;
}

export const FAMILIES: Record<FamilyId, FamilyDef> = {
  ripplekin: {
    id: "ripplekin",
    number: 1,
    name: "Ripplekin",
    code: "RPK",
    nativeElement: "tide",
    roles: ["skirmisher", "striker"],
    silhouette: "a round, translucent bubble body with four frilly fins",
    personality: "playful and splashy",
    flavours: [
      "Small waves. Big mischief.",
      "Blows bubble rings in {habitat} just to watch them wobble.",
      "If a puddle giggles, a Ripplekin is hiding in it.",
      "Collects shiny pebbles from {habitat} and never shares.",
    ],
    artDirection: "a round, glossy bubble-bodied fish creature with big curious eyes and iridescent fin-wings",
  },
  flurri: {
    id: "flurri",
    number: 2,
    name: "Flurri",
    code: "FLR",
    nativeElement: "gale",
    roles: ["skirmisher", "warden"],
    silhouette: "a fluffy cloud-puff pup with long floppy ears",
    personality: "breezy and affectionate",
    flavours: [
      "Rides the wind like it owns a ticket.",
      "Naps in {habitat}, snores in tiny gusts.",
      "Its fur is softer than a Tuesday cloud.",
      "Chases falling leaves and always wins.",
    ],
    artDirection: "a fluffy, cloud-furred puppy-like creature with long floppy ears and a curled tail, mid-leap",
  },
  brimmo: {
    id: "brimmo",
    number: 3,
    name: "Brimmo",
    code: "BRM",
    nativeElement: "ember",
    roles: ["striker", "warden"],
    silhouette: "a stout little dragonling with a spiky crest and round belly",
    personality: "bold, warm-hearted and a little dramatic",
    flavours: [
      "Warm hugs. Hot temper. Mostly hugs.",
      "Toasts marshmallows in {habitat} for anyone who asks nicely.",
      "Its sneeze has lit more than one birthday candle.",
      "Thinks it is enormous. It is not.",
    ],
    artDirection: "a chubby, stubby-legged baby dragon-lizard with a frilly crest, tiny wings and a proud expression",
  },
  mosslet: {
    id: "mosslet",
    number: 4,
    name: "Mosslet",
    code: "MSL",
    nativeElement: "grove",
    roles: ["warden", "skirmisher"],
    silhouette: "a soft, moss-covered blob with a sprout on its head",
    personality: "gentle, patient and quietly helpful",
    flavours: [
      "Where Mosslet wanders, life finds a way.",
      "Hums to seedlings in {habitat} until they sprout.",
      "Sits so still that birds nest on it.",
      "Smells faintly of rain and good ideas.",
    ],
    artDirection: "a round, soft moss-covered blob creature with a single leafy sprout on top and big gentle eyes",
  },
  shardling: {
    id: "shardling",
    number: 5,
    name: "Shardling",
    code: "SHD",
    nativeElement: "ember",
    roles: ["warden", "striker"],
    silhouette: "a pebble-bodied critter crowned with glowing crystal spikes",
    personality: "stubborn, sparkly and secretly shy",
    flavours: [
      "Forged slow. Shines forever.",
      "Hides among {habitat} and glitters when it laughs.",
      "Every crystal is a memory it refuses to forget.",
      "Clinks softly when it walks. Very softly. It's shy.",
    ],
    artDirection: "a small, sturdy stone-bodied creature with a cluster of glowing crystal spikes on its back",
  },
  nyxen: {
    id: "nyxen",
    number: 6,
    name: "Nyxen",
    code: "NYX",
    nativeElement: "gale",
    roles: ["skirmisher", "striker"],
    silhouette: "a slender, fox-like shadow with a wispy tail and glowing eyes",
    personality: "sly, curious and nocturnal",
    flavours: [
      "Here one blink, gone the next.",
      "Whispers secrets to the night in {habitat}.",
      "Borrows shadows and returns them slightly rearranged.",
      "Only seen from the corner of your eye.",
    ],
    artDirection: "a sleek, fox-like creature made of soft shadowy fur with a wispy tail and glowing eyes",
  },
};

export interface VariantDef {
  id: VariantId;
  name: string;
  /** Preview-art pattern. */
  pattern: "none" | "spots" | "bands" | "stars";
  /** Hue shift (degrees) applied to the element hue for preview art. */
  hueShift: number;
  weight: number;
}

export const VARIANTS: Record<VariantId, VariantDef> = {
  dawn: { id: "dawn", name: "Dawn", pattern: "none", hueShift: 25, weight: 20 },
  dusk: { id: "dusk", name: "Dusk", pattern: "none", hueShift: -30, weight: 20 },
  moonlit: { id: "moonlit", name: "Moonlit", pattern: "stars", hueShift: -55, weight: 12 },
  speckled: { id: "speckled", name: "Speckled", pattern: "spots", hueShift: 0, weight: 20 },
  banded: { id: "banded", name: "Banded", pattern: "bands", hueShift: 10, weight: 18 },
  starry: { id: "starry", name: "Starry", pattern: "stars", hueShift: 40, weight: 10 },
};

export interface TraitDef {
  id: string;
  name: string;
  description: string;
  /** Stat budget spent by this trait. Keeps rarer/stronger-sounding traits from being free. */
  cost: number;
  /** Empty = compatible with every element. */
  elements: readonly ElementId[];
  /** Empty = compatible with every role. */
  roles: readonly RoleId[];
  icon: "bubble" | "swirl" | "wind" | "shield" | "flame" | "spark" | "leaf" | "root" | "star" | "heart" | "eye" | "snack";
}

/** Ordered trait pool (order is part of the ruleset). */
export const TRAITS: readonly TraitDef[] = [
  { id: "bubble-dash", name: "Bubble Dash", description: "Dashes in a burst of bubbles.", cost: 4, elements: ["tide"], roles: ["skirmisher", "striker"], icon: "bubble" },
  { id: "current-veil", name: "Current Veil", description: "Briefly cloaks itself in flowing water.", cost: 3, elements: ["tide"], roles: ["warden", "skirmisher"], icon: "swirl" },
  { id: "tidal-hug", name: "Tidal Hug", description: "Wraps a friend in a cool, steadying wave.", cost: 5, elements: ["tide"], roles: ["warden"], icon: "heart" },
  { id: "gust-hop", name: "Gust Hop", description: "Springs off a sudden breeze.", cost: 3, elements: ["gale"], roles: ["skirmisher"], icon: "wind" },
  { id: "whirl-shield", name: "Whirl Shield", description: "Spins the air into a soft barrier.", cost: 4, elements: ["gale"], roles: ["warden"], icon: "shield" },
  { id: "skyward-pounce", name: "Skyward Pounce", description: "Drops from above with a gleeful yip.", cost: 5, elements: ["gale"], roles: ["striker", "skirmisher"], icon: "wind" },
  { id: "cinder-snap", name: "Cinder Snap", description: "A quick, crackling chomp.", cost: 5, elements: ["ember"], roles: ["striker"], icon: "flame" },
  { id: "warm-glow", name: "Warm Glow", description: "Radiates comfort like a hearthstone.", cost: 2, elements: ["ember"], roles: ["warden"], icon: "spark" },
  { id: "spark-sprint", name: "Spark Sprint", description: "Leaves a trail of fizzing sparks.", cost: 4, elements: ["ember"], roles: ["skirmisher"], icon: "spark" },
  { id: "root-stance", name: "Root Stance", description: "Plants its feet and simply will not budge.", cost: 5, elements: ["grove"], roles: ["warden"], icon: "root" },
  { id: "pollen-puff", name: "Pollen Puff", description: "Sneezes a golden, ticklish cloud.", cost: 2, elements: ["grove"], roles: [], icon: "leaf" },
  { id: "thorn-tackle", name: "Thorn Tackle", description: "A bristly, bouncy body-check.", cost: 4, elements: ["grove"], roles: ["striker"], icon: "leaf" },
  { id: "mischief-grin", name: "Mischief Grin", description: "Nobody knows what it's planning.", cost: 0, elements: [], roles: [], icon: "star" },
  { id: "pocket-snack", name: "Pocket Snack", description: "Always has a crumb saved for later.", cost: 1, elements: [], roles: [], icon: "snack" },
  { id: "lucky-wiggle", name: "Lucky Wiggle", description: "Wiggles out of trouble. Usually.", cost: 2, elements: [], roles: [], icon: "star" },
  { id: "night-watch", name: "Night Watch", description: "Keeps one sleepy eye open for friends.", cost: 3, elements: [], roles: ["warden"], icon: "eye" },
  { id: "quick-blink", name: "Quick Blink", description: "Blink and you'll miss it. Really.", cost: 3, elements: [], roles: ["skirmisher"], icon: "eye" },
  { id: "big-heart", name: "Big Heart", description: "Fights hardest when friends are near.", cost: 2, elements: [], roles: ["striker", "warden"], icon: "heart" },
];

export const TRAITS_BY_ID: ReadonlyMap<string, TraitDef> = new Map(TRAITS.map((t) => [t.id, t]));

export function compatibleTraits(element: ElementId, role: RoleId): TraitDef[] {
  return TRAITS.filter(
    (t) => (t.elements.length === 0 || t.elements.includes(element)) && (t.roles.length === 0 || t.roles.includes(role)),
  );
}
