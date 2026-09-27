/**
 * Development seed. The card catalogue lives in versioned code
 * (src/lib/game/catalogue.ts), so the only seeded data is an optional demo
 * player with confirmed contacts and the standard demo-credit grant.
 * Refuses to run in production.
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const DEMO = {
  email: "demo@gubbles.local",
  username: "demo_player",
  phone: "+15555550100",
  password: "gubbles-demo-password",
};
const STARTING_DEMO_CREDIT = 10; // keep in sync with GAME.STARTING_DEMO_CREDIT

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.log("Seed skipped in production.");
    return;
  }
  const db = new PrismaClient();
  try {
    const existing = await db.user.findUnique({ where: { email: DEMO.email } });
    if (existing) {
      console.log(`Demo player already exists: ${DEMO.username}`);
      return;
    }
    const passwordHash = await hash(DEMO.password, { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: DEMO.email,
          username: DEMO.username,
          usernameDisplay: DEMO.username,
          phone: DEMO.phone,
          passwordHash,
          emailConfirmedAt: new Date(),
          phoneConfirmedAt: new Date(),
          termsAcceptedAt: new Date(),
          termsVersion: "2026-09-poc",
          displayName: "Demo Player",
          publicHandle: DEMO.username,
          creditBalance: STARTING_DEMO_CREDIT,
        },
      });
      await tx.creditLedger.create({
        data: { userId: user.id, delta: STARTING_DEMO_CREDIT, balanceAfter: STARTING_DEMO_CREDIT, reason: "SIGNUP_GRANT", referenceId: user.id },
      });
    });
    console.log(`Seeded demo player "${DEMO.username}" (${DEMO.email}) with password "${DEMO.password}" — development only.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
