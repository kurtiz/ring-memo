export type RecordingState = 'unsupported' | 'setup_required' | 'ready' | 'recording' | 'failed';
export type CompletionStatus = 'recording' | 'completed' | 'interrupted' | 'failed';

export interface DiagnosticReview {
  direction: 'incoming' | 'outgoing';
  route: 'handset' | 'speakerphone' | 'bluetooth';
  localVoice: boolean;
  remoteVoice: boolean;
  background: boolean;
  locked: boolean;
}

export interface Recording {
  id: string;
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  fileUri: string;
  title: string;
  notes: string;
  status: CompletionStatus;
  diagnostic: boolean;
  direction: 'incoming' | 'outgoing' | 'unknown';
  bytes: number;
  peak: number;
  identity: string;
  error: string | null;
  review?: DiagnosticReview;
}

export interface RecorderStatus {
  state: RecordingState;
  error: string | null;
  helperAvailable: boolean;
  helperAuthorized: boolean;
  helperConnected: boolean;
  helperUid: number;
  permissionsGranted: boolean;
  notificationsEnabled: boolean;
  consent: boolean;
  armed: boolean;
  currentId: string | null;
  automationRequested: boolean;
  verification: { incoming: number; outgoing: number; background: boolean; locked: boolean; passed: boolean };
  device: { manufacturer: string; model: string; android: string; api: number; fingerprint: string; abis: string[] };
}
