# Gubbles architecture note

## Layers

```
src/app/                 Next.js App Router pages (UI) and /api/v1 route handlers (JSON)
src/lib/game/            Pure, deterministic rules: catalogue, generation, RNG, location, day, caps
src/lib/{auth,discovery,cards,credits,artwork}/   Service layer (business rules, DB, transactions)
src/lib/security/        Crypto helpers, rate limiting, CSRF/origin checks
src/components/          Shared UI (single card renderer in components/card/GubbleCard.tsx)
```

Route handlers are thin: validate the session + CSRF, call a service, map `AppError`
to a stable `{ error: { code, message } }` body. Pages call the same services directly.
Nothing in `src/lib/game` touches the database, clocks, or `Math.random()`.

## Request flow: scan → mint

1. `POST /api/v1/discoveries` (multipart: `image`, `location` JSON). Body is read with a hard byte
   limit, the format is sniffed from magic bytes, dimensions/pixels bounded, image downscaled,
   decoded with ZXing (WASM, loaded from `node_modules`), exactly one QR required. The image is
   never stored.
2. Payload normalized (NFC + trim), HMAC'd into a digest (`QrSource`), location claim validated
   and quantized to a geohash-6 cell. The server picks the UTC day.
3. Unique `(player, source, day)` discovery: a candidate is generated deterministically and
   stored with its seed, cell, ruleset and a 30-minute preview window. Rescans (any cell) return
   the same row; an expired, unminted preview is re-opened with the same content.
4. `POST /api/v1/discoveries/:id/mint` — one transaction: owner/expiry checks, credit debit
   (guarded update, ledger row unique per discovery), daily mint counter, card + traits,
   artwork job. Unique constraints make retries/concurrent requests idempotent.
5. After commit, `after()` runs the artwork job; `npm run worker` is the durable backstop
   (scheduled retries, crashed workers via lock expiry). Jobs are claimed with conditional
   updates, never inside a transaction that spans image generation.

## Expo client (future)

The Expo app should call the same `/api/v1` endpoints; it must not reimplement generation.
Work needed:
- Add a bearer-token session mode (same `Session` table, token in secure storage, `Authorization`
  header) — CSRF checks apply only to cookie auth.
- Camera capture can upload the same multipart request; `expo-location` supplies the same
  claim shape (`latitude, longitude, accuracy, timestamp`).
- Card rendering: port `GubbleCard` to React Native; `CardFace`/`MintedCardView` JSON and the art
  URLs are already renderer-agnostic. Preview art is an SVG string (`renderCreatureSvg`) usable
  with `react-native-svg`, or have the server rasterize it.

## MySQL migration notes

- The schema avoids Prisma enums, `Json` columns and database collation tricks. Statuses are
  strings validated in TypeScript; card traits are relational rows; art specs/candidates are
  versioned serialized text validated by Zod on read.
- Email/username/handle uniqueness relies on the application storing normalized values. On MySQL
  use a binary or `utf8mb4_bin` collation (or keep the default case-insensitive collation — the
  stored values are already lower-case) and make sure `String` columns that hold long text
  (`candidate`, `artSpec`, `artPrompt`) are annotated `@db.Text`.
- Switch the provider, regenerate a **fresh baseline migration** for MySQL (`prisma migrate diff
  --from-empty --to-schema-datamodel`), and copy data with a script. SQLite migrations are not
  replayable on MySQL.
- Transactions: the guarded `UPDATE … WHERE balance >= cost` and `DailyUsage` counters are portable
  and take row locks on InnoDB. `withTransaction` already retries deadlocks (`P2034`). The
  `DailyUsage` upsert may raise `P2002` on a first-of-day race — retry once.
- `RateLimitBucket` should move to Redis at scale.
- Timestamps: use `DATETIME(3)` in UTC; day keys are explicit `YYYY-MM-DD` strings already.

## Security choices

- Sessions: 32-byte opaque token in an HttpOnly, SameSite=Lax cookie (`__Host-` + Secure in
  production); only SHA-256 stored. Rotated on sign-in, second factor, and password change;
  revoked on sign-out, password change/reset.
- CSRF: Origin/Referer must equal `APP_ORIGIN` **and** a custom `x-gubbles-csrf` header is required
  on every mutation.
- CSP: per-request nonce with `strict-dynamic` (see `src/proxy.ts`); styles allow inline because
  React SSR emits `style` attributes. Other headers in `next.config.ts`.
- Passwords: argon2id (19 MiB, t=2). Verification/recovery codes: HMAC-SHA256 with a server key.
  TOTP secrets: AES-256-GCM with versioned keys and user-bound AAD; step replay prevented.
- The QR payload is never stored, displayed, rendered as HTML, or fetched.
