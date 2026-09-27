-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "usernameDisplay" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailConfirmedAt" DATETIME,
    "phoneConfirmedAt" DATETIME,
    "termsAcceptedAt" DATETIME NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "publicHandle" TEXT,
    "ownerIsPublic" BOOLEAN NOT NULL DEFAULT true,
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "deviceHint" TEXT,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL,
    "consumedAt" DATETIME,
    "supersededAt" DATETIME,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "lastSentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TotpCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "secretCipher" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "enabledAt" DATETIME,
    "lastUsedStep" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TotpCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecoveryCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "windowStart" DATETIME NOT NULL,
    "count" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "QrSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "digest" TEXT NOT NULL,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Discovery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "utcDay" TEXT NOT NULL,
    "locationCell" TEXT NOT NULL,
    "locationAccuracyM" INTEGER NOT NULL,
    "rulesetId" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "candidate" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "Discovery_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Discovery_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "QrSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicVerificationId" TEXT NOT NULL,
    "discoveryId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "minterId" TEXT NOT NULL,
    "mintedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mintedUtcDay" TEXT NOT NULL,
    "rulesetId" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "qrDigest" TEXT NOT NULL,
    "locationCell" TEXT NOT NULL,
    "discoveryUtcDay" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "element" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "power" INTEGER NOT NULL,
    "guard" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "flavour" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "artSpec" TEXT NOT NULL,
    "artStatus" TEXT NOT NULL DEFAULT 'ART_PENDING',
    "artPromptVersion" TEXT,
    "artPrompt" TEXT,
    "artProvider" TEXT,
    "artModel" TEXT,
    "artAssetKey" TEXT,
    "artThumbKey" TEXT,
    "artContentHash" TEXT,
    "artMime" TEXT,
    "artWidth" INTEGER,
    "artHeight" INTEGER,
    "artGeneratedAt" DATETIME,
    CONSTRAINT "Card_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "Discovery" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Card_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Card_minterId_fkey" FOREIGN KEY ("minterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CardTrait" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "traitId" TEXT NOT NULL,
    CONSTRAINT "CardTrait_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtworkJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL,
    "nextRunAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArtworkJob_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtworkEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT,
    "actorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArtworkEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyUsage" (
    "userId" TEXT NOT NULL,
    "utcDay" TEXT NOT NULL,
    "discoveries" INTEGER NOT NULL DEFAULT 0,
    "mints" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("userId", "utcDay")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_publicHandle_key" ON "User"("publicHandle");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "VerificationChallenge_userId_purpose_consumedAt_idx" ON "VerificationChallenge"("userId", "purpose", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TotpCredential_userId_key" ON "TotpCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCode_codeHash_key" ON "RecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "QrSource_digest_key" ON "QrSource"("digest");

-- CreateIndex
CREATE INDEX "Discovery_playerId_utcDay_idx" ON "Discovery"("playerId", "utcDay");

-- CreateIndex
CREATE UNIQUE INDEX "Discovery_playerId_sourceId_utcDay_key" ON "Discovery"("playerId", "sourceId", "utcDay");

-- CreateIndex
CREATE UNIQUE INDEX "Card_publicVerificationId_key" ON "Card"("publicVerificationId");

-- CreateIndex
CREATE UNIQUE INDEX "Card_discoveryId_key" ON "Card"("discoveryId");

-- CreateIndex
CREATE INDEX "Card_ownerId_mintedAt_idx" ON "Card"("ownerId", "mintedAt");

-- CreateIndex
CREATE INDEX "Card_minterId_mintedUtcDay_idx" ON "Card"("minterId", "mintedUtcDay");

-- CreateIndex
CREATE INDEX "Card_ownerId_family_idx" ON "Card"("ownerId", "family");

-- CreateIndex
CREATE UNIQUE INDEX "CardTrait_cardId_slot_key" ON "CardTrait"("cardId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "ArtworkJob_cardId_key" ON "ArtworkJob"("cardId");

-- CreateIndex
CREATE INDEX "ArtworkJob_status_nextRunAt_idx" ON "ArtworkJob"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "ArtworkEvent_cardId_createdAt_idx" ON "ArtworkEvent"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditLedger_userId_createdAt_idx" ON "CreditLedger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedger_reason_referenceId_key" ON "CreditLedger"("reason", "referenceId");
