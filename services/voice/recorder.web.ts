// MetroMatrix — the web voice-clip recorder (MediaRecorder webm/opus, a Web
// Audio level meter). See recorderShared.ts. Never imports ./recorder.

import { useCallback, useEffect, useRef, useState } from 'react';
import { IDLE, MAX_CLIP_MS, TICK_MS, clipName, type Clip, type ClipRecorder, type MicPermission, type RecorderState } from './recorderShared';

export * from './recorderShared';

const pickMime = () => {
  const want = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return typeof MediaRecorder !== 'undefined' ? (want.find(m => MediaRecorder.isTypeSupported?.(m)) ?? '') : '';
};

export const useClipRecorder = (): ClipRecorder => {
  const [state, setState] = useState<RecorderState>(IDLE);
  const media = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audio = useRef<{ ctx: AudioContext; analyser: AnalyserNode } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const pending = useRef<Promise<Clip | null> | null>(null);

  const release = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
    void audio.current?.ctx.close().catch(() => undefined);
    audio.current = null;
  };

  const level = () => {
    const a = audio.current;
    if (!a) return null;
    const buf = new Uint8Array(a.analyser.fftSize);
    a.analyser.getByteTimeDomainData(buf);
    let peak = 0;
    for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
    return Math.max(0, Math.min(1, peak * 1.6));
  };

  const permission = useCallback(async (): Promise<MicPermission> => {
    try {
      const p = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
      return p?.state === 'granted' ? 'granted' : p?.state === 'denied' ? 'denied' : 'undetermined';
    } catch {
      return 'undetermined';
    }
  }, []);

  const stop = useCallback(async (): Promise<Clip | null> => {
    if (pending.current) return pending.current;
    const rec = media.current;
    if (!rec || rec.state === 'inactive') return null;
    pending.current = new Promise<Clip | null>(resolve => {
      const durationMs = Date.now() - startedAt.current;
      rec.onstop = () => {
        const type = rec.mimeType || 'audio/webm';
        const blob = new Blob(chunks.current, { type });
        chunks.current = [];
        release();
        setState(IDLE);
        media.current = null;
        if (durationMs <= 300 || blob.size === 0) return resolve(null);
        const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
        resolve({ uri: URL.createObjectURL(blob), name: clipName(ext), mimeType: type.split(';')[0], durationMs, file: blob });
      };
      rec.stop();
    });
    try {
      return await pending.current;
    } finally {
      pending.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return false;
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return false;
    }
    const mimeType = pickMime();
    const rec = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    rec.ondataavailable = e => {
      if (e.data.size) chunks.current.push(e.data);
    };
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream.current).connect(analyser);
      audio.current = { ctx, analyser };
    } catch {
      audio.current = null;
    }
    rec.start(250);
    media.current = rec;
    startedAt.current = Date.now();
    setState({ recording: true, elapsedMs: 0, level: 0 });
    timer.current = setInterval(() => {
      const elapsedMs = Date.now() - startedAt.current;
      if (elapsedMs >= MAX_CLIP_MS) {
        void stop();
        return;
      }
      setState({ recording: true, elapsedMs, level: level() });
    }, TICK_MS);
    return true;
  }, [stop]);

  const cancel = useCallback(async () => {
    const rec = media.current;
    media.current = null;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
      rec.stop();
    }
    chunks.current = [];
    release();
    setState(IDLE);
  }, []);

  useEffect(() => () => release(), []);

  return { state, permission, start, stop, cancel };
};
