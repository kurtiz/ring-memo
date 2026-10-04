import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { recordingSchema, RecordingsRepository } from '../src/data/recordings-repository.ts';

function setup(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(recordingSchema);
  t.after(() => sqlite.close());
  const database = {
    async getAllAsync(sql, ...values) { return sqlite.prepare(sql).all(...values); },
    async getFirstAsync(sql, ...values) { return sqlite.prepare(sql).get(...values) ?? null; },
    async runAsync(sql, ...values) { return sqlite.prepare(sql).run(...values); },
    async withTransactionAsync(operation) {
      sqlite.exec('BEGIN');
      try { await operation(); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const records = new Map();
  const catalog = {
    async listRecordings() { return [...records.values()]; },
    async deleteRecording(id) { records.delete(id); },
  };
  const createRepository = () => new RecordingsRepository(async () => database, () => catalog);
  return { repository: createRepository(), createRepository, records, catalog };
}

function capture(id, changes = {}) {
  return { id, title: 'Test call', notes: '', startedAt: 1000, status: 'recording', bytes: 0, ...changes };
}

test('native finalization updates capture details without overwriting edited title or notes', async (t) => {
  const { repository, records, createRepository } = setup(t);
  records.set('first', capture('first'));
  await repository.reconcile();
  await repository.update('first', '  Appointment  ', 'Discuss next Tuesday');
  records.set('first', capture('first', { status: 'completed', bytes: 64000 }));
  await repository.reconcile();
  const reloaded = createRepository();
  assert.deepEqual(await reloaded.get('first'), capture('first', {
    title: 'Appointment', notes: 'Discuss next Tuesday', status: 'completed', bytes: 64000,
  }));
});

test('search is literal for SQL wildcard characters and finds saved notes', async (t) => {
  const { repository, records } = setup(t);
  records.set('percent', capture('percent', { title: '100%_complete' }));
  records.set('second', capture('second', { title: 'Other conversation', notes: 'appointment details' }));
  await repository.reconcile();
  assert.deepEqual((await repository.list('%_')).map((record) => record.id), ['percent']);
  assert.deepEqual((await repository.list('appointment')).map((record) => record.id), ['second']);
  assert.equal((await repository.list("' OR 1=1 --")).length, 0);
});

test('deletion removes the native file entry and does not resurrect on reconciliation', async (t) => {
  const { repository, records } = setup(t);
  records.set('first', capture('first'));
  await repository.reconcile();
  await Promise.all([repository.reconcile(), repository.delete('first')]);
  await repository.reconcile();
  assert.equal(records.has('first'), false);
  assert.equal(await repository.get('first'), null);
  assert.equal((await repository.list()).length, 0);
});

test('failed native deletion remains retryable across repository restart', async (t) => {
  const { repository, records, catalog, createRepository } = setup(t);
  records.set('first', capture('first'));
  await repository.reconcile();
  catalog.deleteRecording = async () => { throw new Error('Filesystem unavailable'); };
  await assert.rejects(repository.delete('first'), /Filesystem unavailable/);
  assert.equal(await repository.get('first'), null);
  assert.equal(records.has('first'), true);
  catalog.deleteRecording = async (id) => { records.delete(id); };
  const reloaded = createRepository();
  await reloaded.reconcile();
  assert.equal(records.has('first'), false);
  assert.equal((await reloaded.list()).length, 0);
});

test('an empty title is rejected without erasing the stored title', async (t) => {
  const { repository, records } = setup(t);
  records.set('first', capture('first'));
  await repository.reconcile();
  await assert.rejects(repository.update('first', '  ', ''), /Enter a title/);
  assert.equal((await repository.get('first')).title, 'Test call');
});
