import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { reconcileRecordings } from '../data/recordings';
import { recorder, unavailableStatus } from './native';

const RecorderContext = createContext({ status: unavailableStatus, revision: 0, refresh: async () => {} });

export function RecorderProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState(unavailableStatus);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(async () => {
    try {
      const next = recorder ? await recorder.getStatus() : unavailableStatus;
      await reconcileRecordings();
      setStatus(next);
      setRevision((value) => value + 1);
    } catch (error) {
      setStatus((value) => ({ ...value, state: 'failed', error: error instanceof Error ? error.message : 'Could not refresh recordings.' }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const subscription = recorder?.addListener('onStatusChanged', () => { void refresh(); });
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 3000);
    return () => { subscription?.remove(); appState.remove(); clearInterval(timer); };
  }, [refresh]);

  return <RecorderContext value={{ status, revision, refresh }}>{children}</RecorderContext>;
}

export function useRecorder() { return useContext(RecorderContext); }
