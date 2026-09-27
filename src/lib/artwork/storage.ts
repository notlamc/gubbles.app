import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

/** Durable object storage for generated artwork. Swap for S3/GCS/R2 in production. */
export interface AssetStorage {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

const KEY_RE = /^[a-z0-9][a-z0-9/_.-]{0,200}$/;

/** Local filesystem adapter for development. Keys are validated to prevent path traversal. */
export class LocalFsStorage implements AssetStorage {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    if (!KEY_RE.test(key) || key.includes("..")) throw new Error("invalid asset key");
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("invalid asset key");
    return full;
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    const tmp = `${full}.${process.pid}.tmp`;
    await writeFile(tmp, bytes);
    await rename(tmp, full); // atomic publish
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch {
      return null;
    }
  }
}

let storage: AssetStorage | null = null;
export function assetStorage(): AssetStorage {
  storage ??= new LocalFsStorage(path.resolve(process.cwd(), env().ASSET_STORAGE_DIR));
  return storage;
}

export function setAssetStorageForTests(s: AssetStorage | null) {
  storage = s;
}
