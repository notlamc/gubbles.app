/**
 * Stable, machine-readable error codes shared by the web UI and future Expo client.
 * Messages are human-readable and safe to show to the player.
 */
export const ERROR_CODES = {
  VALIDATION_FAILED: 400,
  BAD_ORIGIN: 403,
  UNAUTHENTICATED: 401,
  MFA_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  INVALID_CREDENTIALS: 401,
  INVALID_CODE: 400,
  CODE_EXPIRED: 400,
  TOO_MANY_ATTEMPTS: 429,
  RESEND_COOLDOWN: 429,
  EMAIL_TAKEN: 409,
  USERNAME_TAKEN: 409,
  PHONE_TAKEN: 409,
  HANDLE_TAKEN: 409,
  ACCOUNT_NOT_CONFIRMED: 403,
  DELIVERY_UNAVAILABLE: 503,
  TOTP_ALREADY_ENABLED: 409,
  TOTP_NOT_ENABLED: 409,
  IMAGE_TOO_LARGE: 413,
  IMAGE_UNSUPPORTED: 415,
  IMAGE_INVALID: 422,
  QR_NOT_FOUND: 422,
  QR_MULTIPLE: 422,
  QR_TOO_LONG: 422,
  LOCATION_INVALID: 422,
  LOCATION_STALE: 422,
  LOCATION_IMPRECISE: 422,
  DAILY_DISCOVERY_CAP: 429,
  DAILY_MINT_CAP: 429,
  DISCOVERY_EXPIRED: 410,
  INSUFFICIENT_CREDIT: 402,
  ARTWORK_NOT_RETRYABLE: 409,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_CODES[code];
    this.details = details;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
