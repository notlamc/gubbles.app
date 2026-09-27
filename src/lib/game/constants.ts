/**
 * Every game/economy tunable lives here so policy is reviewable in one place.
 * Changing anything that affects card generation requires a new RULESET_ID.
 */
export const GAME = {
  /** Server-controlled ruleset. Bump when generation rules or the catalogue change. */
  RULESET_ID: "gubbles-v1",

  /** Demo credit (non-purchasable, no monetary value). */
  STARTING_DEMO_CREDIT: 10,
  MINT_COST: 1,

  /** New discoveries a player may create per UTC day. Re-scans of today's codes are free. */
  DAILY_DISCOVERY_CAP: 12,
  /** Mints a player may perform per UTC day. */
  DAILY_MINT_CAP: 5,

  /** How long a discovery preview can be minted before it must be re-scanned (same result). */
  DISCOVERY_PREVIEW_TTL_MS: 30 * 60 * 1000,

  /** Geohash precision for location cells: 6 chars ≈ 1.2 km × 0.6 km (neighbourhood scale). */
  LOCATION_CELL_PRECISION: 6,
  /** Reject client-claimed accuracy worse than this (metres). */
  MAX_LOCATION_ACCURACY_M: 10_000,
  /** A position fix older than this (by the client's own timestamp) is stale. */
  MAX_LOCATION_AGE_MS: 5 * 60 * 1000,
  /** Tolerated client clock skew into the future. */
  MAX_LOCATION_FUTURE_SKEW_MS: 60 * 1000,
} as const;

export const UPLOAD = {
  MAX_BYTES: 5 * 1024 * 1024,
  MAX_WIDTH: 6000,
  MAX_HEIGHT: 6000,
  MAX_PIXELS: 24_000_000,
  /** Images are downscaled to at most this edge before QR decoding, bounding decode cost. */
  DECODE_MAX_EDGE: 1600,
  ACCEPTED_FORMATS: ["png", "jpeg", "webp"] as const,
  /** Maximum QR payload length after normalization (characters). */
  MAX_QR_PAYLOAD_CHARS: 2048,
} as const;

export const ARTWORK = {
  MAX_ATTEMPTS: 3,
  /** Backoff before attempt n (1-based) = BASE * 4^(n-1). */
  RETRY_BASE_MS: 5_000,
  LOCK_MS: 3 * 60 * 1000,
  DISPLAY_SIZE: 1024,
  THUMB_SIZE: 320,
  MAX_PROVIDER_BYTES: 20 * 1024 * 1024,
  MAX_PROVIDER_EDGE: 4096,
  PROMPT_TEMPLATE_VERSION: "art-prompt-v1",
} as const;

/** Rate limits: [max requests, window ms]. Enforced server-side in the database. */
export const RATE_LIMITS = {
  signupPerIp: [10, 60 * 60 * 1000],
  loginPerIp: [30, 15 * 60 * 1000],
  loginPerAccount: [8, 15 * 60 * 1000],
  mfaPerSession: [6, 10 * 60 * 1000],
  codeSendPerUser: [6, 60 * 60 * 1000],
  codeVerifyPerUser: [20, 15 * 60 * 1000],
  passwordResetPerIp: [10, 60 * 60 * 1000],
  passwordResetPerAccount: [3, 60 * 60 * 1000],
  sensitivePerUser: [10, 15 * 60 * 1000],
  uploadPerUser: [30, 10 * 60 * 1000],
  mintPerUser: [30, 10 * 60 * 1000],
  artRetryPerUser: [5, 60 * 60 * 1000],
  publicVerifyPerIp: [120, 60 * 1000],
} as const satisfies Record<string, readonly [number, number]>;

export const AUTH = {
  SESSION_TTL_MS: 30 * 24 * 60 * 60 * 1000,
  MFA_PENDING_TTL_MS: 10 * 60 * 1000,
  SESSION_TOUCH_INTERVAL_MS: 5 * 60 * 1000,
  PASSWORD_MIN: 12,
  PASSWORD_MAX: 128,
  CODE_TTL_MS: 10 * 60 * 1000,
  CODE_MAX_ATTEMPTS: 5,
  CODE_RESEND_COOLDOWN_MS: 60 * 1000,
  RECOVERY_CODE_COUNT: 10,
  TERMS_VERSION: "2026-09-poc",
} as const;
