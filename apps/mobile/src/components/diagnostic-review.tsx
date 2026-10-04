import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Action, Body, colors, Panel } from './ui';
import { requireRecorder } from '../recording/native';
import { useRecorder } from '../recording/provider';
import type { DiagnosticReview, Recording } from '../recording/types';

export function DiagnosticReviewForm({ recording }: { recording: Recording }) {
  const { refresh } = useRecorder();
  const [review, setReview] = useState<DiagnosticReview>(recording.review ?? {
    direction: recording.direction === 'incoming' ? 'incoming' : 'outgoing', route: 'handset',
    localVoice: false, remoteVoice: false, background: false, locked: false,
  });
  return <Panel>
    <Body accent>Review this test capture</Body>
    <Body>Listen to the complete recording. Only mark a voice as captured if you can clearly understand it. A silent or one-sided recording fails.</Body>
    <Body>Call direction</Body>
    {(['incoming', 'outgoing'] as const).map((direction) => <Action key={direction} label={`${review.direction === direction ? '✓ ' : ''}${direction}`} secondary
      onPress={() => setReview((value) => ({ ...value, direction }))} />)}
    <Body>Audio route used during the call</Body>
    {(['handset', 'speakerphone', 'bluetooth'] as const).map((route) => <Action key={route} label={`${review.route === route ? '✓ ' : ''}${route}`} secondary
      onPress={() => setReview((value) => ({ ...value, route }))} />)}
    {([
      ['localVoice', 'I can understand my voice'], ['remoteVoice', 'I can understand the other person'],
      ['background', 'RingMemo was in the background'], ['locked', 'The screen was locked during capture'],
    ] as const).map(([key, label]) => <View key={key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1 }}><Body>{label}</Body></View>
      <Switch accessibilityLabel={label} trackColor={{ true: colors.accent }} value={review[key]}
        onValueChange={(enabled) => setReview((value) => ({ ...value, [key]: enabled }))} />
    </View>)}
    <Action label="Save test review" onPress={async () => { await requireRecorder().reviewDiagnostic(recording.id, review); await refresh(); }} />
  </Panel>;
}
