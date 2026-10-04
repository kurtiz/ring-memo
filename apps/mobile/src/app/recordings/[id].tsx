import { File } from 'expo-file-system';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { DiagnosticReviewForm } from '../../components/diagnostic-review';
import { RecordingPlayer } from '../../components/recording-player';
import { RecordingEditor } from '../../components/recording-editor';
import { Action, Body, colors, Heading, Screen } from '../../components/ui';
import { deleteRecording, exportRecording, getRecording } from '../../data/recordings';
import { canPlayRecording, eligibleForReview, formatDuration } from '../../recording/policy';
import { useRecorder } from '../../recording/provider';
import type { Recording } from '../../recording/types';

export default function RecordingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { revision, refresh } = useRecorder();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getRecording(id).then((value) => { if (active) { setRecording(value); setLoaded(true); setError(null); } })
      .catch((failure: unknown) => { if (active) { setError(failure instanceof Error ? failure.message : 'Could not load recording.'); setLoaded(true); } });
    return () => { active = false; };
  }, [id, revision]);
  if (!recording) return <Screen><Link href="/" style={{ color: colors.accent }}>← Library</Link><Heading>{loaded ? 'Recording unavailable' : 'Loading recording…'}</Heading>{error ? <Body>{error}</Body> : null}</Screen>;
  const audioAvailable = canPlayRecording(recording) && new File(recording.fileUri).exists;
  return <Screen>
    <Link href="/" style={{ color: colors.accent, paddingVertical: 8 }}>← Library</Link>
    <Heading>{recording.title}</Heading>
    <Body>{new Date(recording.startedAt).toLocaleString()} · {formatDuration(recording.durationMs)} · {recording.status}</Body>
    {recording.error ? <Body>{recording.error}</Body> : null}
    {audioAvailable ? <RecordingPlayer uri={recording.fileUri} /> : <Body>{recording.status === 'recording' ? 'Audio becomes available when the recording ends.' : 'No playable audio was saved for this capture.'}</Body>}
    {recording.status === 'interrupted' ? <Body>This capture was interrupted. Any recoverable audio may be incomplete.</Body> : null}
    <RecordingEditor key={recording.id} recording={recording} />
    <Action label="Export audio" secondary disabled={!audioAvailable} onPress={() => exportRecording(recording)} />
    {eligibleForReview(recording) ? <DiagnosticReviewForm key={recording.id} recording={recording} /> : recording.diagnostic ? <Body>Only completed, non-silent test captures of at least three seconds can be reviewed.</Body> : null}
    <Action label="Delete recording" danger disabled={recording.status === 'recording'} onPress={() => {
      Alert.alert('Delete this recording?', 'The audio and notes will be permanently removed from this phone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteRecording(id); await refresh(); router.replace('/'); }
          catch (failure) { Alert.alert('Deletion incomplete', failure instanceof Error ? failure.message : 'Could not delete the recording.'); await refresh(); }
        } },
      ]);
    }} />
  </Screen>;
}
