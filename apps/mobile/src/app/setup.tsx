import { Link } from 'expo-router';
import { Alert, Linking, Switch, Text, View } from 'react-native';
import { Action, Body, colors, Heading, Panel, Screen } from '../components/ui';
import { exportDiagnosticReport } from '../data/recordings';
import { recorder, requestRecorderPermissions, requireRecorder } from '../recording/native';
import { canArmDiagnostic, canEnableAutomation } from '../recording/policy';
import { useRecorder } from '../recording/provider';

export default function Setup() {
  const { status, refresh } = useRecorder();
  const verified = status.verification;
  return <Screen>
    <Link href="/" style={{ color: colors.accent, paddingVertical: 8 }}>← Library</Link>
    <Heading>Recording setup</Heading>
    <Body>First test both voices on your Galaxy A21s. A file with audio does not prove that the other person was captured.</Body>
    <Panel>
      <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 18 }}>1. Recording consent</Text>
      <Body>I will only record calls where I have the required consent. Recording is visible in the app and its notification.</Body>
      <Action label={status.consent ? 'Consent acknowledged' : 'I understand and acknowledge'} disabled={!recorder || status.consent}
        onPress={async () => { await requireRecorder().acknowledgeConsent(true); await refresh(); }} />
    </Panel>
    <Panel>
      <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 18 }}>2. Phone permissions</Text>
      <Body>{status.permissionsGranted ? 'Audio and phone state permissions granted.' : 'Allow audio access and phone state to run the capture experiment. Contacts and call history are not requested.'}</Body>
      <Body>{status.notificationsEnabled ? 'Recording notifications enabled.' : 'Enable notifications so recording status remains visible.'}</Body>
      <Action label="Grant permissions" secondary disabled={!recorder} onPress={async () => { await requestRecorderPermissions(); await refresh(); }} />
      <Action label="Open Android app settings" secondary onPress={() => Linking.openSettings()} />
    </Panel>
    <Panel>
      <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 18 }}>3. Connect the helper</Text>
      <Body>Install and start Shizuku using wireless debugging or a computer. Then authorize RingMemo. Restart the helper after a phone reboot.</Body>
      <Body accent>{status.helperConnected ? `Connected · ${status.helperUid === 0 ? 'root' : 'ADB'} privileges` : status.helperAvailable ? 'Shizuku detected; authorization or connection needed.' : 'Shizuku is not running.'}</Body>
      <Action label="Shizuku setup instructions" secondary onPress={() => Linking.openURL('https://shizuku.rikka.app/guide/setup/')} />
      <Action label="Authorize / reconnect Shizuku" disabled={!recorder || !status.helperAvailable} onPress={async () => { await requireRecorder().requestHelperAuthorization(); await refresh(); }} />
    </Panel>
    <Panel>
      <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 18 }}>4. Test one call</Text>
      <Body>Arm a test, then make or answer one cellular call. Speak in turns for at least 10 seconds. Let the call end, then play the result from your library and review both voices.</Body>
      <Body>A normal handset call is required for verification. Test speakerphone and Bluetooth separately. Outgoing capture may include dialing audio.</Body>
      <Action label="Arm one test call" disabled={!canArmDiagnostic(status)} onPress={async () => { await requireRecorder().armDiagnostic(); await refresh(); }} />
      {status.armed ? <Action label={status.currentId ? 'Stop current test' : 'Cancel armed session'} secondary onPress={async () => { await requireRecorder().disarm(); await refresh(); }} /> : null}
      <Body accent>{verified.incoming}/5 incoming · {verified.outgoing}/5 outgoing</Body>
      <Body>{verified.background ? '✓' : '○'} Background test · {verified.locked ? '✓' : '○'} Locked-screen test</Body>
    </Panel>
    <Panel>
      <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 18 }}>5. Automatic recording</Text>
      <Body>{verified.passed ? 'Both-voice tests passed for this firmware and helper privilege. Enable recording for incoming and outgoing cellular calls.' : 'Automatic recording is locked until five incoming and five outgoing handset tests pass, including background and locked screen.'}</Body>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Body>Record all cellular calls</Body>
        <Switch accessibilityLabel="Record all cellular calls" trackColor={{ true: colors.accent }}
          value={status.automationRequested} disabled={!recorder || (!status.automationRequested && !canEnableAutomation(status))}
          onValueChange={async (enabled) => {
            try { await requireRecorder().setAutomationEnabled(enabled); await refresh(); }
            catch (error) { Alert.alert('RingMemo', error instanceof Error ? error.message : 'Could not change recording mode.'); await refresh(); }
          }} />
      </View>
      {status.automationRequested && !status.armed ? <Action label="Rearm automatic recording" disabled={!canEnableAutomation(status)} onPress={async () => { await requireRecorder().setAutomationEnabled(true); await refresh(); }} /> : null}
      <Body>After a reboot or process interruption, open RingMemo and rearm. A firmware change or helper privilege change requires new tests.</Body>
    </Panel>
    {status.error ? <Body>{status.error}</Body> : null}
    <Action label="Export device test report" secondary disabled={!recorder} onPress={exportDiagnosticReport} />
  </Screen>;
}
