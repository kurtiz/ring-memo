import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canArmDiagnostic, canEnableAutomation, canPlayRecording, eligibleForReview, formatDuration } from '../src/recording/policy.ts';

const status = {
  state: 'setup_required', consent: true, permissionsGranted: true, notificationsEnabled: true,
  helperAuthorized: true, helperConnected: true, armed: false, verification: { passed: false },
};
const capture = { diagnostic: true, status: 'completed', durationMs: 10000, bytes: 320000, peak: 2000 };

test('a diagnostic can run before verification, but automation cannot', () => {
  assert.equal(canArmDiagnostic(status), true);
  assert.equal(canEnableAutomation(status), false);
  assert.equal(canEnableAutomation({ ...status, verification: { passed: true } }), true);
});

test('permission loss, hidden notifications, helper loss and consent revocation block recording', () => {
  for (const field of ['consent', 'permissionsGranted', 'notificationsEnabled', 'helperAuthorized', 'helperConnected']) {
    const unavailable = { ...status, [field]: false, verification: { passed: true } };
    assert.equal(canArmDiagnostic(unavailable), false, field);
    assert.equal(canEnableAutomation(unavailable), false, field);
  }
});

test('an armed service cannot start a competing diagnostic', () => {
  assert.equal(canArmDiagnostic({ ...status, armed: true }), false);
  assert.equal(canArmDiagnostic({ ...status, state: 'unsupported' }), false);
});

test('partial captures are playable but cannot certify call capture', () => {
  assert.equal(canPlayRecording({ ...capture, status: 'interrupted' }), true);
  assert.equal(eligibleForReview({ ...capture, status: 'interrupted' }), false);
  assert.equal(eligibleForReview({ ...capture, status: 'failed' }), false);
});

test('file size cannot certify silence, short samples or unreviewable captures', () => {
  assert.equal(eligibleForReview(capture), true);
  for (const changes of [{ peak: 0 }, { bytes: 0 }, { durationMs: 2000 }, { diagnostic: false }, { status: 'recording' }]) {
    assert.equal(eligibleForReview({ ...capture, ...changes }), false);
  }
  assert.equal(canPlayRecording({ ...capture, status: 'recording' }), false);
  assert.equal(canPlayRecording({ ...capture, bytes: 0 }), false);
});

test('duration formatting handles recovered zero-length files and long calls', () => {
  assert.equal(formatDuration(-1), '0:00');
  assert.equal(formatDuration(61000), '1:01');
  assert.equal(formatDuration(3661000), '61:01');
});
