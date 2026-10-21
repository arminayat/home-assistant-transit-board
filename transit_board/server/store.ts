import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_APP_CONFIG, MAX_BODY_BYTES, migrateSavedConfig, normalizeAppConfig } from "../src/config.ts";

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
  private current = snapshot(DEFAULT_APP_CONFIG);
  private loadError?: HttpError;
  private writes: Promise<void> = Promise.resolve();
  private legacySource?: Buffer;

  constructor(private readonly dataDir: string) {
    this.file = join(dataDir, "config.json");
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    try {
      if ((await stat(this.file)).size > MAX_BODY_BYTES) throw new Error("Stored configuration is too large.");
      const source = await readFile(this.file);
      const value: unknown = JSON.parse(source.toString("utf8"));
      this.current = snapshot(migrateSavedConfig(value));
      if (value && typeof value === "object" && !("cards" in value)) this.legacySource = source;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
      this.loadError = new HttpError(503,
        error instanceof RangeError ? `${error.message} The saved file has been preserved.` :
          "The saved board could not be read. Its file has been preserved. Restore /data/config.json from a backup, or move it aside and restart the App to start fresh.");
    }
  }

  async get(): Promise<Snapshot> {
    await this.ready;
    if (this.loadError) throw this.loadError;
    return this.current;
  }

  private async syncDirectory(): Promise<void> {
    const directory = await open(this.dataDir, "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }

  private async backupLegacy(): Promise<void> {
    if (!this.legacySource) return;
    const backup = join(this.dataDir, "config.v1.backup.json");
    let created = false;
    try {
      const file = await open(backup, "wx", 0o600);
      created = true;
      try {
        await file.writeFile(this.legacySource);
        await file.sync();
      } finally {
        await file.close();
      }
      // Make the backup directory entry durable before replacing the legacy source.
      await this.syncDirectory();
    } catch (error) {
      if (created) await rm(backup, { force: true }).catch(() => {});
      if (!created && error instanceof Error && "code" in error && error.code === "EEXIST") {
        try {
          if ((await readFile(backup)).equals(this.legacySource)) {
            await this.syncDirectory();
            return;
          }
        } catch { /* An unreadable or mismatched backup must never be replaced. */ }
      }
      throw new HttpError(500, "The original single-card settings could not be safely backed up. Check App storage and any existing config.v1.backup.json before retrying. The saved configuration has been preserved.");
    }
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
        await this.backupLegacy();
        await rename(temporary, this.file);
        this.current = next;
        this.legacySource = undefined;
        return next;
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(500, "The board could not be saved. The previous saved configuration has been kept. Try again after checking App storage.");
      } finally {
        await rm(temporary, { force: true }).catch(() => {});
      }
    });
    this.writes = operation.then(() => {}, () => {});
    return operation;
  }
}
