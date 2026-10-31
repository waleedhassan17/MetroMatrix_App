// ═══════════════════════════════════════════════════════
// MetroMatrix — the vendor's new-order alert
// ═══════════════════════════════════════════════════════
// A looping chime (assets/sounds/new_order.wav, made for MetroMatrix) and a
// repeating vibration that run until the order is opened or accepted:
// `start()` when a new order lands, `stop()` once it is seen. Idempotent.
//
// The board also keeps the screen awake (expo-keep-awake). When the app is
// in the background the API's push carries the sound instead, on the
// Android channel `new-orders` (notifications/push.ts).
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
    player = audio.createAudioPlayer(require('../assets/sounds/new_order.wav'));
    player.loop = true;
  } catch {
    player = null;
  }
  return player;
};

/** How often (and how many times) the web checks that playback began before pausing it. */
const PAUSE_CHECK_MS = 100;
const PAUSE_CHECKS = 10;

/**
 * Pause. A browser rejects a play() that is paused before it starts (and
 * expo-audio doesn't catch that), so on the web: silent at once, paused once
 * playback has begun — unless it's ringing again by then.
 */
const quiet = (p: AudioPlayer) => {
  try {
    // On the web `playing` turns true as soon as play() is called; the clock moving means it really began.
    const begun = () => p.currentTime > 0;
    if (Platform.OS !== 'web' || begun()) return p.pause();
    p.volume = 0;
    let checks = 0;
    const timer = setInterval(() => {
      checks += 1;
      if (!begun() && checks < PAUSE_CHECKS) return;
      clearInterval(timer);
      if (state.ringing) return;
      p.pause();
    }, PAUSE_CHECK_MS);
  } catch {
    /* the player is gone (app backgrounded) — nothing to stop */
  }
};

const play = () => {
  const p = loadPlayer();
  if (!p) return set({ blocked: Platform.OS === 'web' });
  try {
    p.volume = 1;
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
    if (player) quiet(player);
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
        if (p) {
          p.play();
          quiet(p);
        }
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
