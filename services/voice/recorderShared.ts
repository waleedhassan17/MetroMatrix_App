// ═══════════════════════════════════════════════════════
// MetroMatrix — Voice clips: what the native and web recorders share
// ═══════════════════════════════════════════════════════
// One hook for every mic in the app (the board, stock, purchases, Today,
// search, the pantry): ask for the microphone, record up to 30 seconds with
// a live level, stop and hand back a file the media upload takes. Native
// records AAC (.m4a) with expo-audio (recorder.ts); the web records
// webm/opus with MediaRecorder and reads its level with Web Audio
// (recorder.web.ts). Kept apart from both on purpose: a .web file must
// never import its own name (CLAUDE.md, sheetShared.ts).

import type { LocalFile } from '../../types/auth';

export const MAX_CLIP_MS = 30_000;
/** How often the level and the clock update while recording. */
export const TICK_MS = 100;

export type MicPermission = 'granted' | 'denied' | 'undetermined';

export interface Clip extends LocalFile {
  durationMs: number;
}

export interface RecorderState {
  recording: boolean;
  elapsedMs: number;
  /** 0–1, null where the device can't measure it. */
  level: number | null;
}

export interface ClipRecorder {
  state: RecorderState;
  permission: () => Promise<MicPermission>;
  /** Asks for the microphone if needed; false when it was refused. */
  start: () => Promise<boolean>;
  /** The clip (null: nothing was recorded). Stops by itself at MAX_CLIP_MS. */
  stop: () => Promise<Clip | null>;
  cancel: () => Promise<void>;
}

export const IDLE: RecorderState = { recording: false, elapsedMs: 0, level: null };

/** dBFS (-160 … 0) → 0–1, with the quiet room floor at -50 dB. */
export const levelOfDb = (db: number | undefined | null) => (typeof db === 'number' && Number.isFinite(db) ? Math.max(0, Math.min(1, (db + 50) / 50)) : null);

export const clipName = (ext: string) => `voice-${Date.now().toString(36)}.${ext}`;
