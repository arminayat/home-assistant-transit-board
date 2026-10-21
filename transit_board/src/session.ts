import { normalizeAppConfig, type AppConfig } from './config.ts';
import { loadConfig, saveConfig, type Snapshot } from './client.ts';

const same = (a: AppConfig | undefined, b: AppConfig | undefined): boolean => JSON.stringify(a) === JSON.stringify(b);
const message = (error: unknown): string => error instanceof Error ? error.message : 'Settings request failed. Try again.';

/** Owns the saved revision and draft so background updates cannot discard edits. */
export class BoardSession {
  saved?: Snapshot;
  draft?: AppConfig;
  remote?: Snapshot;
  saving = false;
  loading = false;
  error = '';
  validationError = '';
  notice = '';
  private generation = 0;

  constructor(private changed: () => void, private read = loadConfig, private write = saveConfig) {}

  get dirty(): boolean { return Boolean(this.validationError) || !same(this.draft, this.saved?.config); }

  edit(value: unknown): void {
    this.generation += 1;
    this.notice = '';
    try { this.draft = normalizeAppConfig(value); this.validationError = ''; }
    catch (error) { this.validationError = message(error); }
    this.changed();
  }

  async refresh(): Promise<void> {
    if (this.loading || this.saving) return;
    const generation = ++this.generation;
    this.loading = true;
    this.changed();
    try {
      const next = await this.read();
      if (generation !== this.generation) return;
      if (!this.dirty || !this.validationError && same(next.config, this.draft)) {
        this.saved = next;
        this.draft = normalizeAppConfig(next.config);
        this.remote = undefined;
        this.error = '';
      } else if (next.etag !== this.saved?.etag) {
        this.remote = next;
      } else {
        this.remote = undefined;
      }
      this.error = '';
    } catch (error) {
      if (generation === this.generation) this.error = message(error);
    } finally {
      this.loading = false;
      this.changed();
    }
  }

  async save(): Promise<void> {
    if (!this.saved || !this.draft || this.validationError || this.saving || !this.dirty) return;
    const submitted = normalizeAppConfig(this.draft);
    const etag = this.saved.etag;
    this.generation += 1;
    this.saving = true;
    this.error = '';
    this.notice = '';
    this.changed();
    try {
      const next = await this.write(submitted, etag);
      this.saved = next;
      this.remote = undefined;
      // Draft may have changed while the immutable submitted snapshot was in flight.
      this.notice = this.dirty ? 'Saved. You have more unsaved changes.' : 'Board saved for everyone.';
    } catch (error) { this.error = message(error); }
    finally { this.saving = false; this.changed(); }
  }

  cancel(): void {
    if (this.saving) return;
    this.generation += 1;
    if (this.remote) this.saved = this.remote;
    this.remote = undefined;
    this.draft = this.saved && normalizeAppConfig(this.saved.config);
    this.validationError = '';
    this.error = '';
    this.notice = '';
    this.changed();
  }

  async reload(): Promise<void> {
    if (this.saving || this.loading) return;
    const generation = ++this.generation;
    this.loading = true;
    this.changed();
    try {
      const next = await this.read();
      if (generation !== this.generation) return;
      this.saved = next;
      this.draft = normalizeAppConfig(next.config);
      this.remote = undefined;
      this.validationError = '';
      this.error = '';
      this.notice = 'Loaded the saved board.';
    } catch (error) { this.error = message(error); }
    finally { this.loading = false; this.changed(); }
  }
}
