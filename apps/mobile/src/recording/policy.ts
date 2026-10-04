import type { Recording, RecorderStatus } from './types';

export function canArmDiagnostic(status: RecorderStatus) {
  return status.state !== 'unsupported' && status.consent && status.permissionsGranted &&
    status.notificationsEnabled && status.helperAuthorized && status.helperConnected && !status.armed;
}

export function canEnableAutomation(status: RecorderStatus) {
  return status.verification.passed && canArmDiagnostic(status);
}

export function canPlayRecording(recording: Recording) {
  return recording.status !== 'recording' && recording.bytes > 0;
}

export function eligibleForReview(recording: Recording) {
  return recording.diagnostic && recording.status === 'completed' && recording.durationMs >= 3000 &&
    recording.bytes > 0 && recording.peak > 0;
}

export function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
