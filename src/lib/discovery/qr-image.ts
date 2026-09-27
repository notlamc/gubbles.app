import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prepareZXingModule, readBarcodes, type ReadResult } from "zxing-wasm/reader";
import { AppError } from "@/lib/api/errors";
import { UPLOAD } from "@/lib/game/constants";

type Format = (typeof UPLOAD.ACCEPTED_FORMATS)[number];
type SharpImage = ReturnType<typeof sharp>;
type SharpMetadata = Awaited<ReturnType<SharpImage["metadata"]>>;

// Don't let sharp cache decoded images in memory between requests.
sharp.cache(false);
sharp.concurrency(1);

/** Identify the real file format from magic bytes (the filename/Content-Type are ignored). */
export function sniffImageFormat(buf: Uint8Array): Format | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "webp";
  return null;
}

let zxingReady: Promise<unknown> | null = null;

/** Load the ZXing WASM binary from node_modules (never from a CDN). */
function ensureZxing() {
  zxingReady ??= (async () => {
    const wasmPath = path.join(process.cwd(), "node_modules", "zxing-wasm", "dist", "reader", "zxing_reader.wasm");
    const wasmBinary = await readFile(wasmPath);
    return prepareZXingModule({
      overrides: { wasmBinary: wasmBinary.buffer.slice(wasmBinary.byteOffset, wasmBinary.byteOffset + wasmBinary.byteLength) as ArrayBuffer },
      fireImmediately: true,
    });
  })();
  return zxingReady;
}

async function decodePixels(img: SharpImage): Promise<ReadResult[]> {
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return readBarcodes(
    { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height, colorSpace: "srgb" } as ImageData,
    { formats: ["QRCode"], tryHarder: true, maxNumberOfSymbols: 8 },
  );
}

/**
 * Validate an uploaded image and extract exactly one QR payload.
 * - bounded bytes, real format sniffed from content, bounded dimensions/pixels
 * - EXIF/metadata ignored (only pixels are read); the image is never persisted
 * - image downscaled before decoding to bound CPU cost
 */
export async function extractSingleQrPayload(bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength === 0) throw new AppError("IMAGE_INVALID", "That file is empty.");
  if (bytes.byteLength > UPLOAD.MAX_BYTES) {
    throw new AppError("IMAGE_TOO_LARGE", `Images must be ${UPLOAD.MAX_BYTES / 1024 / 1024} MB or smaller.`);
  }
  const sniffed = sniffImageFormat(bytes);
  if (!sniffed) throw new AppError("IMAGE_UNSUPPORTED", "Please upload a PNG, JPEG or WebP image.");

  const input = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const open = () => sharp(input, { limitInputPixels: UPLOAD.MAX_PIXELS, failOn: "error", pages: 1, sequentialRead: true });

  let meta: SharpMetadata;
  try {
    meta = await open().metadata();
  } catch {
    throw new AppError("IMAGE_INVALID", "We couldn't read that image. Is it corrupted?");
  }
  if (meta.format !== sniffed) throw new AppError("IMAGE_UNSUPPORTED", "That file's contents don't match a supported image type.");
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 21 || h < 21) throw new AppError("IMAGE_INVALID", "That image is too small to contain a QR code.");
  if (w > UPLOAD.MAX_WIDTH || h > UPLOAD.MAX_HEIGHT || w * h > UPLOAD.MAX_PIXELS) {
    throw new AppError("IMAGE_TOO_LARGE", `Images can be at most ${UPLOAD.MAX_WIDTH}×${UPLOAD.MAX_HEIGHT} pixels.`);
  }

  await ensureZxing();
  const resize = { width: UPLOAD.DECODE_MAX_EDGE, height: UPLOAD.DECODE_MAX_EDGE, fit: "inside" as const, withoutEnlargement: true };
  let results: ReadResult[];
  try {
    results = await decodePixels(open().resize(resize));
    if (!results.some((r) => r.isValid)) {
      // Second, contrast-normalised pass for dim photos.
      results = await decodePixels(open().resize(resize).grayscale().normalise());
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("IMAGE_INVALID", "We couldn't process that image.");
  }

  const payloads = new Set(results.filter((r) => r.isValid && r.format === "QRCode").map((r) => r.text));
  if (payloads.size === 0) {
    throw new AppError("QR_NOT_FOUND", "No QR code spotted. Try a sharper, closer photo with the whole code in frame.");
  }
  if (payloads.size > 1) {
    throw new AppError("QR_MULTIPLE", "We found more than one QR code. Crop the photo so only one code shows.");
  }
  return [...payloads][0]!;
}
