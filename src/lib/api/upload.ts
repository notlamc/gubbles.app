import "server-only";
import { AppError } from "./errors";
import { UPLOAD } from "@/lib/game/constants";

/** Read a request body, aborting as soon as it exceeds `maxBytes` (Content-Length is not trusted). */
export async function readBoundedBody(req: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new AppError("IMAGE_TOO_LARGE", `Images must be ${UPLOAD.MAX_BYTES / 1024 / 1024} MB or smaller.`);
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new AppError("IMAGE_TOO_LARGE", `Images must be ${UPLOAD.MAX_BYTES / 1024 / 1024} MB or smaller.`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

/** Parse a bounded multipart body into { image bytes, location JSON }. */
export async function readDiscoveryUpload(req: Request): Promise<{ image: Uint8Array; location: unknown }> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data")) throw new AppError("VALIDATION_FAILED", "Upload the image as multipart/form-data.");
  const body = await readBoundedBody(req, UPLOAD.MAX_BYTES + 64 * 1024);
  let form: FormData;
  try {
    form = await new Request("http://local/upload", { method: "POST", headers: { "content-type": type }, body: body as BodyInit }).formData();
  } catch {
    throw new AppError("VALIDATION_FAILED", "We couldn't read that upload.");
  }
  const file = form.get("image");
  if (!(file instanceof Blob)) throw new AppError("VALIDATION_FAILED", "Choose an image to scan.");
  if (file.size > UPLOAD.MAX_BYTES) throw new AppError("IMAGE_TOO_LARGE", `Images must be ${UPLOAD.MAX_BYTES / 1024 / 1024} MB or smaller.`);
  const rawLocation = form.get("location");
  let location: unknown = null;
  if (typeof rawLocation === "string" && rawLocation.length < 512) {
    try {
      location = JSON.parse(rawLocation);
    } catch {
      location = null;
    }
  }
  return { image: new Uint8Array(await file.arrayBuffer()), location };
}
