# Gubbles — proof of concept

A mobile-friendly Next.js proof of concept for **Gubbles**, a collectible creature card game
("Gubbles" is a working title). Players sign up, confirm their email and phone, upload a photo
of any QR code, share an approximate browser location, preview a deterministically generated
Gubble card, and mint it into their collection with free demo credit. Every minted card gets
generated creature art and a public verification page and QR code.

> **What this is not (yet):** trading, battles, real email/SMS delivery, GPS verification,
> payments or paid credit, a marketplace, or blockchain. None of them are implemented.
> Demo credit is free, can't be bought, and has no monetary value.

## Quick start

Requirements: Node.js ≥ 20.19, npm. On npm 11 the install scripts for Prisma, esbuild,
Tailwind and unrs-resolver are pre-approved in `package.json#allowScripts`.

```bash
npm install
cp .env.example .env            # then fill in the three secrets (command is in the file)
npx prisma migrate dev          # creates prisma/dev.db and applies migrations
npm run db:seed                 # optional: demo player (see below)
npm run dev                     # http://localhost:3000
npm run worker                  # optional, 2nd terminal: durable artwork-job worker
```

Development-only seeded player: `demo_player` / `gubbles-demo-password`. Both contacts are
pre-confirmed. The seed refuses to run when `NODE_ENV=production`.

**Verification codes** are printed to the **server console** only, for example:

```
[gubbles:dev-delivery] channel=EMAIL to=you@example.com purpose=CONFIRM_EMAIL code=123456 (development only — not sent)
```

They never appear in HTTP responses or browser logs. With `NODE_ENV=production`, console
delivery refuses to send. No real provider is wired up.

**Location**: browsers only expose geolocation over HTTPS or on `localhost`. To test on a
phone, use an HTTPS tunnel and set `APP_ORIGIN` to that origin.

**QR fixtures**: `fixtures/qr-single.png` (plus `.jpg`/`.webp` variants), `qr-multiple.png` and
`no-qr.png`. Regenerate them with `npm run fixtures`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run lint` | ESLint (flat config from `eslint-config-next`) |
| `npm test` | Vitest unit + integration tests against a disposable SQLite DB (`prisma/test.db`) |
| `npm run test:e2e` | Playwright smoke test. It starts its own dev server on :3100 with its own DB and reads codes from the captured server log. Uses the preinstalled Chromium. |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:reset` | Prisma migrations and seed |
| `npm run worker` | Drains due artwork jobs: retries, and jobs whose worker crashed |

## How it works

- **Scan**: the image is bounded to 5 MB and at most 6000 px per side (24 MP). Its format is
  sniffed from its bytes (PNG/JPEG/WebP). It is downscaled and decoded server-side with
  ZXing-WASM, and exactly one QR code is required. The image and the raw payload are never
  stored, and links inside codes are never opened. The payload is normalized (Unicode NFC and
  outer whitespace only) and HMAC'd into a persistent digest.
- **Location**: the browser's claim is validated (range, accuracy ≤ 10 km, fresh within 5 min)
  and quantized to a geohash-6 cell, roughly 1.2 × 0.6 km. Only the cell is kept. The location is
  labelled unverified everywhere. There is no silent IP fallback.
- **Determinism**: the server chooses the UTC day. The seed is an HMAC over (ruleset, player,
  digest, day, cell). One discovery exists per (player, code, UTC day). A rescan the same day
  returns the original discovery, even from a different area, and the UI says the result is
  locked in. A later day can produce a different card. See [docs/card-rules.md](docs/card-rules.md).
- **Mint**: accepts only a discovery ID. A single transaction checks the owner, the 30-minute
  preview expiry, the daily cap (5 mints) and the credit, then debits 1 credit, creates one
  `ART_PENDING` card and queues an artwork job. Retries and concurrent requests return the same
  card with no second debit. The daily discovery cap is 12 new discoveries. Rescans and failed
  uploads don't count towards it; they are only rate-limited.
- **Artwork**: runs after the mint commits (`after()` plus the worker). There are 3 attempts
  with backoff, then `ART_FAILED` with a free, audited manual retry. Display (1024 px) and
  thumbnail (320 px) WebP renditions go to object storage, with a local filesystem adapter under
  `.data/assets`. They are served from stable `/api/v1/art/{cardId}/{display|thumb}` URLs. Approved
  art is immutable.
- **Verification**: `/verify/cards/{publicVerificationId}` is a live database read on each request
  and is marked noindex. It shows the card, the current owner's public handle (or "Owner is
  private"), and when ownership was checked. It shows no location, QR payload or contact details.

All tunables are in [`src/lib/game/constants.ts`](src/lib/game/constants.ts).

## Artwork providers and cost

- `ARTWORK_PROVIDER=stub` (default): deterministic local renderer that rasterizes the card's
  SVG art. It is **not AI**, and the UI labels it as stub art.
- `ARTWORK_PROVIDER=openai` with `OPENAI_API_KEY` and `ARTWORK_MODEL` (default `gpt-image-1`): calls
  the OpenAI Images API server-side with a versioned prompt built only from fixed card attributes.
  The prompt, template version, provider/model, content hash and timestamp are stored per card.
  The cost is one image per minted card: at most 5 per player per day, plus up to 2 automatic
  retries, plus manual repairs (rate-limited to 5 per hour). Check current provider pricing before
  enabling it. Requests time out after `ARTWORK_TIMEOUT_MS`.
- This adapter was never run against the live OpenAI API here; every test uses the stub or
  injected fakes. Validate it with a real key before relying on it.

## API

Versioned JSON under `/api/v1`. The UI and a future Expo client share it. Errors look like
`{ "error": { "code": "STABLE_CODE", "message": "…", "fields"?: {…} } }`. Every mutation needs a
same-origin `Origin` and the `x-gubbles-csrf: 1` header.

| Area | Endpoints |
|---|---|
| Auth | `POST auth/signup`, `auth/signin`, `auth/signin/mfa`, `auth/signout`, `auth/password/forgot`, `auth/password/reset`; `GET auth/session` |
| Account | `POST account/confirm/send`, `account/confirm`, `account/contact`, `account/contact/confirm`; `GET/PATCH account/profile` |
| Security | `GET security`; `POST security/password`; `GET security/sessions`; `DELETE security/sessions/{id}`; `POST security/sessions/revoke-others`; `POST security/totp/{setup,activate,disable,recovery-codes}` |
| Game | `POST discoveries` (multipart `image` + `location`); `GET discoveries/{id}`; `POST discoveries/{id}/mint`; `GET cards?family&element&rarity`; `GET cards/{id}`; `GET cards/{id}/artwork`; `POST cards/{id}/artwork/retry`; `GET credits` |
| Public | `GET public/cards/{publicId}`; `GET art/{cardId}/{display\|thumb}` |

## Project layout and further docs

- [docs/architecture.md](docs/architecture.md) covers layers, the scan→mint flow, security
  choices, the **Expo client path** and **MySQL migration notes**.
- [docs/card-rules.md](docs/card-rules.md) covers generation inputs, mapping layers, balance
  rules and the catalogue.

## Status

Verified in this environment:
- typecheck and lint are clean
- 79 Vitest unit and integration tests pass
- `next build` succeeds
- the Playwright mobile smoke test passes: sign up → console codes → confirm both channels →
  upload QR with mocked geolocation → preview → mint → art status goes from generating to ready
  → collection shows the image → public verification signed-out → change password → enrol TOTP
  → sign out → sign in with TOTP. A second test checks redirects, CSRF rejection and 401s.

Known gaps and next steps:
- No real email/SMS provider. Production deployments must add one; console delivery is refused
  there.
- The OpenAI adapter is untested against the live API (see above). Object storage is local
  filesystem only.
- Rate limiting is stored in the database, and the API has no bearer-token mode for Expo yet.
- Trading, battles, weakness/resistance, deck building and the card export image are
  intentionally not implemented. The ownership records and the verification page are designed
  so transfers can be added transactionally later.
- `npm audit` reports a high-severity advisory in `deepmerge-ts`, pulled in by the Prisma 6 CLI
  (`@prisma/config`). It only affects the development tooling, and there is no fixed Prisma 6
  release yet.
