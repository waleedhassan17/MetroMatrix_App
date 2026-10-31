// MetroMatrix — the native voice-clip recorder (expo-audio, AAC .m4a). See recorderShared.ts.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { IDLE, MAX_CLIP_MS, TICK_MS, clipName, levelOfDb, type Clip, type ClipRecorder, type MicPermission, type RecorderState } from './recorderShared';

export * from './recorderShared';

// One channel at 22 kHz: speech, small uploads (about 25 KB a second).
const OPTIONS = { ...RecordingPresets.LOW_QUALITY, numberOfChannels: 1, isMeteringEnabled: true };

export const useClipRecorder = (): ClipRecorder => {
  const recorder = useAudioRecorder(OPTIONS);
  const [state, setState] = useState<RecorderState>(IDLE);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const stopping = useRef<Promise<Clip | null> | null>(null);

  const clear = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const permission = useCallback(async (): Promise<MicPermission> => {
    const p = await AudioModule.getRecordingPermissionsAsync();
    return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
  }, []);

  const stop = useCallback(async (): Promise<Clip | null> => {
    if (stopping.current) return stopping.current;
    if (!recorder.isRecording) return null;
    stopping.current = (async () => {
      clear();
      const durationMs = Date.now() - startedAt.current;
      try {
        await recorder.stop();
      } finally {
        setState(IDLE);
        await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      }
      const uri = recorder.uri;
      return uri && durationMs > 300 ? { uri, name: clipName('m4a'), mimeType: 'audio/m4a', durationMs } : null;
    })();
    try {
      return await stopping.current;
    } finally {
      stopping.current = null;
    }
  }, [recorder]);

  const start = useCallback(async () => {
    const p = await AudioModule.requestRecordingPermissionsAsync();
    if (!p.granted) return false;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    startedAt.current = Date.now();
    setState({ recording: true, elapsedMs: 0, level: 0 });
    clear();
    timer.current = setInterval(() => {
      const elapsedMs = Date.now() - startedAt.current;
      if (elapsedMs >= MAX_CLIP_MS) {
        void stop();
        return;
      }
      setState({ recording: true, elapsedMs, level: levelOfDb(recorder.getStatus().metering) });
    }, TICK_MS);
    return true;
  }, [recorder, stop]);

  const cancel = useCallback(async () => {
    clear();
    if (recorder.isRecording) await recorder.stop().catch(() => undefined);
    setState(IDLE);
  }, [recorder]);

  useEffect(() => () => clear(), []);

  return { state, permission, start, stop, cancel };
};
