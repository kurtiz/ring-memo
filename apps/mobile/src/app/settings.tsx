import { Link } from 'expo-router';
import { Text } from 'react-native';
import { Action, Body, colors, Heading, Panel, Screen } from '../components/ui';
import { exportDiagnosticReport } from '../data/recordings';
import { recorder, requireRecorder } from '../recording/native';
import { useRecorder } from '../recording/provider';

export default function Settings() {
  const { status, refresh } = useRecorder();
  return <Screen>
    <Link href="/" style={{ color: colors.accent, paddingVertical: 8 }}>← Library</Link>
    <Heading>Settings</Heading>
    <Panel>
      <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '600' }}>Recording</Text>
      <Body>{status.armed ? 'The recording service is armed.' : 'The recording service is stopped.'}</Body>
      <Link href="/setup" style={{ color: colors.accent, paddingVertical: 10 }}>Manage recording setup →</Link>
      <Action label="Disable automatic recording" secondary disabled={!recorder || (!status.automationRequested && !status.armed)} onPress={async () => {
        await requireRecorder().setAutomationEnabled(false); await refresh();
      }} />
    </Panel>
    <Panel>
      <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '600' }}>Your recordings stay here</Text>
      <Body>Audio and notes are stored in this app’s private storage. No account, cloud upload, or transcription service is connected. Recordings remain until you delete them.</Body>
      <Body>Export a recording to keep a separate copy. Uninstalling the app deletes its library. Android app backup is disabled.</Body>
    </Panel>
    <Panel>
      <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '600' }}>Device testing</Text>
      <Body>{status.device.model || 'Android development build required'}{status.device.android ? ` · Android ${status.device.android}` : ''}</Body>
      <Body>{status.verification.passed ? 'Handset tests passed on this firmware.' : 'Cellular call capture remains unproven.'}</Body>
      <Action label="Export diagnostic report" secondary disabled={!recorder} onPress={exportDiagnosticReport} />
    </Panel>
    <Action label="Revoke consent and stop recording" danger disabled={!status.consent} onPress={async () => { await requireRecorder().acknowledgeConsent(false); await refresh(); }} />
  </Screen>;
}
