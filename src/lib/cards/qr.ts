import "server-only";
import QRCode from "qrcode";

/** Verification QR as an SVG data URI. Encodes ONLY the canonical public verification URL. */
export async function verificationQrDataUri(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#0c1030", light: "#ffffff" } });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
