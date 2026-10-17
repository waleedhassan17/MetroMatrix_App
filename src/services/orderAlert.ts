// ═══════════════════════════════════════════════════════
// MetroMatrix — the vendor's new-order alert
// ═══════════════════════════════════════════════════════
// A looping chime (assets/sounds/new_order.wav, made for MetroMatrix) and a
// repeating vibration that run until the order is opened or accepted:
// `start()` when a new order lands, `stop()` once it is seen. Idempotent.
//
// The board also keeps the screen awake (expo-keep-awake). When the app is
// in the background the API's push carries the sound instead, on the
// Android channel `new-orders` (services/push.ts).
//
// Browsers block sound until the page has been tapped once. On web a start
// that can't play reports `blocked`, and the board shows "Tap to turn on
// order sound" — that tap calls `unlock()`. Never throws.

import { Platform, Vibration } from 'react-native';
import type { AudioPlayer } from 'expo-audio';

export interface OrderAlertState {
  ringing: boolean;
  /** The browser refused to play before a tap (web autoplay rule). */
  blocked: boolean;
}

/** Vibrate 0.5 s, rest, 0.5 s, then a longer rest — repeated while ringing. */
const VIBRATION = [0, 500, 300, 500, 1200];
/** How long the web waits before deciding the browser refused to play. */
const AUTOPLAY_CHECK_MS = 400;

let player: AudioPlayer | null = null;
let state: OrderAlertState = { ringing: false, blocked: false };
const listeners = new Set<(s: OrderAlertState) => void>();

const set = (next: Partial<OrderAlertState>) => {
  state = { ...state, ...next };
  listeners.forEach(l => l(state));
};

const loadPlayer = (): AudioPlayer | null => {
  if (player) return player;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const audio = require('expo-audio') as typeof import('expo-audio');
    void audio.setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    player = audio.createAudioPlayer(require('../../assets/sounds/new_order.wav'));
    player.loop = true;
  } catch {
    player = null;
  }
  return player;
};

const play = () => {
  const p = loadPlayer();
  if (!p) return set({ blocked: Platform.OS === 'web' });
  try {
    void p.seekTo(0).catch(() => undefined);
    p.play();
  } catch {
    return set({ blocked: Platform.OS === 'web' });
  }
  if (Platform.OS === 'web') {
    setTimeout(() => {
      if (state.ringing && !p.playing) set({ blocked: true });
    }, AUTOPLAY_CHECK_MS);
  }
};

export const orderAlert = {
  start() {
    if (state.ringing) return;
    set({ ringing: true, blocked: false });
    play();
    if (Platform.OS !== 'web') Vibration.vibrate(VIBRATION, true);
  },

  stop() {
    if (!state.ringing) return;
    set({ ringing: false, blocked: false });
    try {
      player?.pause();
    } catch {
      /* the player is gone (app backgrounded) — nothing to stop */
    }
    if (Platform.OS !== 'web') Vibration.cancel();
  },

  /** From a tap (web): the browser now allows sound, so a blocked alert plays. */
  unlock() {
    if (state.ringing) {
      set({ blocked: false });
      play();
    } else {
      // Prime the player inside the gesture so the next order can sound.
      const p = loadPlayer();
      try {
        p?.play();
        p?.pause();
      } catch {
        /* still blocked — the banner stays */
      }
    }
  },

  get state(): OrderAlertState {
    return state;
  },

  subscribe(listener: (s: OrderAlertState) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
