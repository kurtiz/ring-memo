import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Action, Body, colors, Field, Heading, Panel, Screen } from '../components/ui';
import { listRecordings } from '../data/recordings';
import { requireRecorder } from '../recording/native';
import { formatDuration } from '../recording/policy';
import { useRecorder } from '../recording/provider';
import type { Recording } from '../recording/types';

export default function Home() {
  const { status, revision, refresh } = useRecorder();
  const [search, setSearch] = useState('');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void listRecordings(search).then((items) => { if (active) { setRecordings(items); setError(null); } })
      .catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : 'Could not open the library.'); });
    return () => { active = false; };
  }, [search, revision]);

  return <Screen>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: colors.accent, fontWeight: '700', letterSpacing: 2 }}>RINGMEMO</Text>
      <Link href="/settings" style={{ color: colors.accent, paddingVertical: 12 }}>Settings</Link>
    </View>
    <Heading>Your conversations.</Heading>
    <Body>Saved on your phone. Ready when you need them.</Body>
    <Panel>
      <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '600' }}>
        {status.state === 'recording' ? 'Recording this call' : status.armed ? 'Armed for calls' : status.automationRequested ? 'Automatic recording needs rearming' : status.verification.passed ? 'Device tests passed' : 'Recording needs verification'}
      </Text>
      <Body>{status.error ?? (status.armed ? 'The recording service is active. You can stop it here or in the notification.' : status.automationRequested ? 'Open recording setup, reconnect the helper if needed, and rearm recording.' : status.verification.passed ? 'Open recording setup to enable automatic recording.' : 'Set up the helper and test both voices before enabling automatic recording.')}</Body>
      {status.armed ? <Action label={status.currentId ? 'Stop this recording' : 'Disarm recording'} secondary onPress={async () => {
        if (status.currentId) await requireRecorder().stopCurrentRecording(); else await requireRecorder().disarm();
        await refresh();
      }} /> : <Link href="/setup" style={{ color: colors.accent, fontSize: 16, paddingVertical: 8 }}>Open recording setup →</Link>}
    </Panel>
    <Field label="Search titles and notes" value={search} onChangeText={setSearch} />
    {error ? <Body>{error}</Body> : null}
    {recordings.length === 0 ? <Panel>
      <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '600' }}>{search ? 'No matches' : 'Your library starts here'}</Text>
      <Body>{search ? 'Try a different title or a word from your notes.' : 'Test captures will appear here after a call. Capture failures remain visible so you can see what happened.'}</Body>
    </Panel> : recordings.map((recording) => <Link key={recording.id} href={{ pathname: '/recordings/[id]', params: { id: recording.id } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${recording.title}`} style={({ pressed }) => ({ paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.surface, opacity: pressed ? 0.6 : 1, gap: 7 })}>
        <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '600' }}>{recording.title}</Text>
        <Body>{new Date(recording.startedAt).toLocaleString()} · {formatDuration(recording.durationMs)}</Body>
        <Text style={{ color: recording.status === 'failed' || recording.status === 'interrupted' ? colors.danger : colors.accent, fontSize: 13 }}>
          {recording.status}{recording.diagnostic ? ' · test capture' : ''}{recording.review ? ' · reviewed' : ''}
        </Text>
      </Pressable>
    </Link>)}
  </Screen>;
}
