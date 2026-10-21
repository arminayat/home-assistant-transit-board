import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { MAX_BODY_BYTES, normalizeAppConfig } from "../src/config.ts";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface Snapshot {
  json: string;
  etag: string;
}

function snapshot(value: unknown): Snapshot {
  const json = JSON.stringify(normalizeAppConfig(value));
  return { json, etag: `"${createHash("sha256").update(json).digest("hex")}"` };
}

export class ConfigStore {
  private readonly file: string;
  private readonly ready: Promise<void>;
  private current = snapshot({});
  private loadError?: HttpError;
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly dataDir: string) {
    this.file = join(dataDir, "config.json");
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    try {
      if ((await stat(this.file)).size > MAX_BODY_BYTES) throw new Error("Stored configuration is too large.");
      this.current = snapshot(JSON.parse(await readFile(this.file, "utf8")));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
      this.loadError = new HttpError(503,
        "The saved board could not be read. Its file has been preserved. Restore /data/config.json from a backup, or move it aside and restart the App to start fresh.");
    }
  }

  async get(): Promise<Snapshot> {
    await this.ready;
    if (this.loadError) throw this.loadError;
    return this.current;
  }

  async save(value: unknown, expected: string): Promise<Snapshot> {
    let next: Snapshot;
    try {
      next = snapshot(value);
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Invalid board configuration.");
    }
    const operation = this.writes.then(async () => {
      const current = await this.get();
      if (expected !== current.etag) {
        throw new HttpError(412, "The shared board changed elsewhere. Your unsaved edits have been kept. Reload the saved board before saving again.");
      }
      const temporary = join(this.dataDir, `.config-${randomUUID()}.tmp`);
      try {
        await mkdir(this.dataDir, { recursive: true, mode: 0o700 });
        const file = await open(temporary, "wx", 0o600);
        try {
          await file.writeFile(next.json, "utf8");
          await file.sync();
        } finally {
          await file.close();
        }
        await rename(temporary, this.file);
        this.current = next;
        return next;
      } catch {
        throw new HttpError(500, "The board could not be saved. The previous saved configuration has been kept. Try again after checking App storage.");
      } finally {
        await rm(temporary, { force: true }).catch(() => {});
      }
    });
    this.writes = operation.then(() => {}, () => {});
    return operation;
  }
}
