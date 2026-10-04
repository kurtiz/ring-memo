import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Action, Body, Panel } from './ui';
import { formatDuration } from '../recording/policy';

export function RecordingPlayer({ uri }: { uri: string }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  return <Panel>
    <Body accent>{formatDuration(status.currentTime * 1000)} / {formatDuration(status.duration * 1000)}</Body>
    <Action label={status.playing ? 'Pause' : 'Play recording'} disabled={!status.isLoaded} onPress={async () => {
      if (status.playing) player.pause(); else {
        if (status.didJustFinish || status.currentTime >= status.duration) await player.seekTo(0);
        player.play();
      }
    }} />
    <Action label="Back 10 seconds" secondary disabled={!status.isLoaded} onPress={() => player.seekTo(Math.max(0, status.currentTime - 10))} />
    <Action label="Forward 10 seconds" secondary disabled={!status.isLoaded} onPress={() => player.seekTo(Math.min(status.duration, status.currentTime + 10))} />
    {!status.isLoaded ? <Body>Loading audio. If it cannot load, this capture may be incomplete.</Body> : null}
  </Panel>;
}
