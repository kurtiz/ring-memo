import { useState } from 'react';
import { Action, Field } from './ui';
import { updateRecording } from '../data/recordings';
import { useRecorder } from '../recording/provider';
import type { Recording } from '../recording/types';

export function RecordingEditor({ recording }: { recording: Recording }) {
  const [title, setTitle] = useState(recording.title);
  const [notes, setNotes] = useState(recording.notes);
  const { refresh } = useRecorder();
  return <>
    <Field label="Recording title" value={title} onChangeText={setTitle} />
    <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
    <Action label="Save title and notes" disabled={!title.trim()} onPress={async () => {
      await updateRecording(recording.id, title, notes); await refresh();
    }} />
  </>;
}
