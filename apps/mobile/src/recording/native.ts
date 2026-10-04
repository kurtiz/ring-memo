import { NativeModule, requireOptionalNativeModule } from 'expo';
import { PermissionsAndroid, Platform } from 'react-native';
import type { DiagnosticReview, Recording, RecorderStatus } from './types';

declare class RecorderModule extends NativeModule<{ onStatusChanged: (status: RecorderStatus) => void }> {
  getStatus(): Promise<RecorderStatus>;
  requestHelperAuthorization(): Promise<boolean>;
  acknowledgeConsent(accepted: boolean): Promise<RecorderStatus>;
  armDiagnostic(): Promise<boolean>;
  setAutomationEnabled(enabled: boolean): Promise<boolean>;
  stopCurrentRecording(): Promise<boolean>;
  disarm(): Promise<boolean>;
  listRecordings(): Promise<Recording[]>;
  deleteRecording(id: string): Promise<boolean>;
  reviewDiagnostic(id: string, review: DiagnosticReview): Promise<RecorderStatus>;
  getDiagnosticReport(): Promise<string>;
}

export const recorder = requireOptionalNativeModule<RecorderModule>('RingMemoRecorder');

export const unavailableStatus: RecorderStatus = {
  state: 'unsupported', error: 'Install the RingMemo Android APK. Native recording is unavailable in Expo Go.',
  helperAvailable: false, helperAuthorized: false, helperConnected: false, helperUid: -1,
  permissionsGranted: false, notificationsEnabled: false, consent: false, armed: false,
  currentId: null, automationRequested: false,
  verification: { incoming: 0, outgoing: 0, background: false, locked: false, passed: false },
  device: { manufacturer: '', model: '', android: '', api: 0, fingerprint: '', abis: [] },
};

export function requireRecorder() {
  if (!recorder) throw new Error(unavailableStatus.error!);
  return recorder;
}

export async function requestRecorderPermissions() {
  if (Platform.OS !== 'android') throw new Error('RingMemo recording requires Android.');
  const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE];
  if (Number(Platform.Version) >= 33) permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  await PermissionsAndroid.requestMultiple(permissions);
}
