import path from "node:path";
import * as OTPAuth from "otpauth";
import { expect, test, type Page } from "@playwright/test";
import { logSize, readCode } from "./codes";

const FIXTURE = path.resolve(__dirname, "..", "fixtures", "qr-single.png");

function totp(secret: string, offsetMs = 0) {
  return OTPAuth.TOTP.generate({ secret: OTPAuth.Secret.fromBase32(secret), algorithm: "SHA1", digits: 6, period: 30, timestamp: Date.now() + offsetMs });
}

async function signIn(page: Page, identifier: string, password: string) {
  await page.goto("/signin");
  await page.getByLabel("Email or username").fill(identifier);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("sign up → confirm → scan → mint → artwork → security → sign out/in with TOTP", async ({ page }) => {
  const id = Date.now().toString(36);
  const email = `e2e_${id}@example.com`;
  const phone = `+1555${String(Date.now()).slice(-7)}`;
  const username = `e2e_${id}`.slice(0, 20);
  let password = "a very silly e2e password";

  // --- Sign up --------------------------------------------------------------
  const logStart = logSize();
  await page.goto("/signup");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Mobile phone").fill(phone);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("checkbox").check();
  await page.locator("form button[type=submit]").click();
  await page.waitForURL("**/confirm");

  // --- Confirm both channels with codes read from the SERVER console --------
  const emailCode = await readCode(email, "CONFIRM_EMAIL", logStart);
  const phoneCode = await readCode(phone, "CONFIRM_PHONE", logStart);
  // Codes never appear in the page itself.
  await expect(page.locator("body")).not.toContainText(emailCode);
  const codeInputs = page.getByLabel(/Code sent to your/);
  await codeInputs.first().fill(emailCode);
  await page.getByRole("button", { name: /Confirm email/i }).click();
  await expect(page.getByText(/confirmed/i).first()).toBeVisible();
  await page.getByLabel(/Code sent to your/).last().fill(phoneCode);
  await page.getByRole("button", { name: /Confirm phone/i }).click();
  await page.getByRole("link", { name: /Start discovering/i }).click();
  await page.waitForURL("**/play");

  // --- Scan a QR image with mocked geolocation ------------------------------
  await page.goto("/scan");
  await page.setInputFiles('[data-testid="qr-file"]', FIXTURE);
  await page.getByRole("button", { name: /reveal/i }).click();
  await page.waitForURL(/\/discoveries\//);
  await expect(page.getByRole("heading", { name: "Discovery!" })).toBeVisible();
  await expect(page.getByText(/Found near/)).toBeVisible();

  // --- Mint ---------------------------------------------------------------
  await expect(page.getByRole("button", { name: /Mint for 1 demo credit/ })).toBeEnabled();
  await page.getByRole("button", { name: /Mint for 1 demo credit/ }).click();
  await page.waitForURL(/\/cards\/[a-z0-9]+\?minted=1/);
  await expect(page.getByText(/Welcome to the collection/)).toBeVisible();
  // Artwork status: pending → ready (stub provider).
  await expect(page.getByText("Artwork ready")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/not AI-generated/)).toBeVisible();
  await expect(page.getByRole("img", { name: /QR code linking to the public verification page/ })).toBeVisible();
  const verifyHref = await page.getByRole("link", { name: /View verification/ }).getAttribute("href");

  // --- Collection shows the completed image --------------------------------
  await page.goto("/collection");
  const thumb = page.locator("main ul li img").first();
  await expect(thumb).toHaveAttribute("src", /\/api\/v1\/art\/.+\/thumb/);
  await expect(page.getByText("9", { exact: true }).first()).toBeVisible(); // demo credit after one mint

  // --- Public verification works signed-out --------------------------------
  const anon = await page.context().browser()!.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(verifyHref!);
  await expect(anonPage.getByTestId("current-owner")).toContainText(`@${username.toLowerCase()}`);
  await expect(anonPage.locator("body")).not.toContainText(email);
  await anon.close();

  // --- Change password ------------------------------------------------------
  await page.goto("/security");
  const newPassword = "an even sillier e2e password";
  await page.getByRole("textbox", { name: "Current password", exact: true }).fill(password);
  await page.getByRole("textbox", { name: "New password", exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed")).toBeVisible();
  password = newPassword;

  // --- Enrol TOTP -----------------------------------------------------------
  await page.getByRole("button", { name: /Turn on two-step/ }).click();
  await page.getByRole("textbox", { name: "Your password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  const secret = (await page.locator('code[aria-labelledby="totp-secret-label"]').innerText()).replace(/\s/g, "");
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
  await page.getByRole("button", { name: /I've added it/ }).click();
  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.locator("form button[type=submit]").last().click();
  await expect(page.getByRole("list", { name: "Recovery codes" })).toBeVisible();
  await page.getByRole("button", { name: /I've saved these/ }).click();

  // --- Sign out, then sign in with password + TOTP --------------------------
  await page.goto("/profile");
  await page.getByRole("button", { name: /Sign out/ }).first().click();
  await page.waitForURL("**/signin**");
  await signIn(page, email, password);
  await page.waitForURL("**/signin/two-step");
  // Use the next time step so the enrolment code can't be a replay.
  await page.getByLabel("Authenticator code").fill(totp(secret, 30_000));
  await page.getByRole("button", { name: /Verify and continue/ }).click();
  await page.waitForURL("**/play");
  await expect(page.getByRole("heading", { name: /Hey/ })).toBeVisible();
});

test("protected pages redirect when signed out, and APIs reject cross-origin mutations", async ({ page, request }) => {
  await page.goto("/collection");
  await page.waitForURL("**/signin");
  const res = await request.post("/api/v1/auth/signin", {
    headers: { origin: "https://evil.example", "x-gubbles-csrf": "1" },
    data: { identifier: "x", password: "y" },
  });
  expect(res.status()).toBe(403);
  expect((await res.json()).error.code).toBe("BAD_ORIGIN");
  const anon = await request.get("/api/v1/cards");
  expect(anon.status()).toBe(401);
});
