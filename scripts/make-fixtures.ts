/** Regenerates the QR fixture images in ./fixtures (committed to the repo). */
import QRCode from "qrcode";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

async function qrPng(text: string, width = 360) {
  return QRCode.toBuffer(text, { type: "png", width, margin: 2, errorCorrectionLevel: "M" });
}

async function main() {
  await mkdir("fixtures", { recursive: true });
  await sharp(await qrPng("https://example.com/gubbles/park-bench-42")).toFile("fixtures/qr-single.png");
  await sharp(await qrPng("GUBBLES-FIXTURE: lighthouse café ☕")).jpeg({ quality: 90 }).toFile("fixtures/qr-single-2.jpg");
  await sharp(await qrPng("  Plain text code with padding  ")).webp().toFile("fixtures/qr-single-3.webp");

  const a = await qrPng("first code", 300);
  const b = await qrPng("second code", 300);
  await sharp({ create: { width: 680, height: 340, channels: 3, background: "#ffffff" } })
    .composite([{ input: a, left: 20, top: 20 }, { input: b, left: 360, top: 20 }])
    .png()
    .toFile("fixtures/qr-multiple.png");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#bde0fe"/><circle cx="200" cy="150" r="90" fill="#ffafcc"/><text x="200" y="160" font-size="28" text-anchor="middle" fill="#333">no code here</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile("fixtures/no-qr.png");
  console.log("fixtures written");
}

void main();
