import { File, Paths } from 'expo-file-system';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import * as Sharing from 'expo-sharing';
import { recorder, requireRecorder } from '../recording/native';
import type { Recording } from '../recording/types';
import { recordingSchema, RecordingsRepository } from './recordings-repository';

let database: Promise<SQLiteDatabase> | undefined;
function getDatabase() {
  database ??= (async () => {
    const db = await openDatabaseAsync('ringmemo.db');
    await db.execAsync(recordingSchema);
    return db;
  })();
  return database;
}

const repository = new RecordingsRepository(getDatabase, requireRecorder);
export const reconcileRecordings = () => recorder ? repository.reconcile() : Promise.resolve();
export const listRecordings = (search = '') => repository.list(search);
export const getRecording = (id: string) => repository.get(id);
export const updateRecording = (id: string, title: string, notes: string) => repository.update(id, title, notes);
export const deleteRecording = (id: string) => repository.delete(id);

export async function exportRecording(recording: Recording) {
  if (recording.status === 'recording') throw new Error('Stop recording before exporting.');
  if (!new File(recording.fileUri).exists) throw new Error('This audio file is missing.');
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
  await Sharing.shareAsync(recording.fileUri, { mimeType: 'audio/wav', dialogTitle: recording.title });
}

export async function exportDiagnosticReport() {
  const report = await requireRecorder().getDiagnosticReport();
  const file = new File(Paths.cache, 'ringmemo-diagnostics.json');
  file.create({ overwrite: true });
  file.write(report);
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'RingMemo device test report' });
}
