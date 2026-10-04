import type { Recording } from '../recording/types';

type Bind = string | number;
export interface RecordingDatabase {
  getAllAsync<T>(sql: string, ...values: Bind[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...values: Bind[]): Promise<T | null>;
  runAsync(sql: string, ...values: Bind[]): Promise<unknown>;
  withTransactionAsync(operation: () => Promise<void>): Promise<void>;
}

export interface RecordingCatalog {
  listRecordings(): Promise<Recording[]>;
  deleteRecording(id: string): Promise<unknown>;
}

interface Row { id: string; payload: string; title: string; notes: string; deleting: number }

export const recordingSchema = `PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY, payload TEXT NOT NULL, title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '', started_at INTEGER NOT NULL, deleting INTEGER NOT NULL DEFAULT 0
  ); PRAGMA user_version = 1;`;

export class RecordingsRepository {
  private queue: Promise<unknown> = Promise.resolve();
  private database: () => Promise<RecordingDatabase>;
  private catalog: () => RecordingCatalog;
  constructor(database: () => Promise<RecordingDatabase>, catalog: () => RecordingCatalog) {
    this.database = database;
    this.catalog = catalog;
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }

  reconcile() {
    return this.serialize(async () => {
      const db = await this.database();
      const catalog = this.catalog();
      const pending = await db.getAllAsync<Row>('SELECT * FROM recordings WHERE deleting = 1');
      for (const row of pending) {
        await catalog.deleteRecording(row.id);
        await db.runAsync('DELETE FROM recordings WHERE id = ?', row.id);
      }
      const recordings = await catalog.listRecordings();
      await db.withTransactionAsync(async () => {
        for (const recording of recordings) {
          await db.runAsync(`INSERT INTO recordings (id, payload, title, notes, started_at) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, started_at = excluded.started_at`,
          recording.id, JSON.stringify(recording), recording.title, recording.notes, recording.startedAt);
        }
      });
    });
  }

  async list(search = ''): Promise<Recording[]> {
    const db = await this.database();
    const query = search.trim().replace(/[\\%_]/g, '\\$&');
    const rows = await db.getAllAsync<Row>(`SELECT * FROM recordings WHERE deleting = 0
      AND (title LIKE ? ESCAPE '\\' OR notes LIKE ? ESCAPE '\\') ORDER BY started_at DESC`, `%${query}%`, `%${query}%`);
    return rows.map((row) => this.recording(row));
  }

  async get(id: string) {
    const db = await this.database();
    const row = await db.getFirstAsync<Row>('SELECT * FROM recordings WHERE id = ? AND deleting = 0', id);
    return row ? this.recording(row) : null;
  }

  update(id: string, title: string, notes: string) {
    return this.serialize(async () => {
      if (!title.trim()) throw new Error('Enter a title for this recording.');
      const db = await this.database();
      await db.runAsync('UPDATE recordings SET title = ?, notes = ? WHERE id = ? AND deleting = 0', title.trim(), notes, id);
    });
  }

  delete(id: string) {
    return this.serialize(async () => {
      const db = await this.database();
      const catalog = this.catalog();
      await db.runAsync('UPDATE recordings SET deleting = 1 WHERE id = ?', id);
      // Preserve the tombstone if native deletion fails; retry on next reconciliation.
      await catalog.deleteRecording(id);
      await db.runAsync('DELETE FROM recordings WHERE id = ?', id);
    });
  }

  private recording(row: Row): Recording {
    return { ...JSON.parse(row.payload) as Recording, title: row.title, notes: row.notes };
  }
}
