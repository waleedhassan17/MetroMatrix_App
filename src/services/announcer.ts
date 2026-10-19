// ═══════════════════════════════════════════════════════
// MetroMatrix — Spoken new-order announcements (the vendor's board)
// ═══════════════════════════════════════════════════════
// After the new-order chime's first ring the board says the order out
// loud, in the language the kitchen picked in Settings (Off / Urdu /
// English): with the phone's own voice (expo-speech, ur-PK or en-US); if
// the phone has no Urdu voice, the API's recorded clip (`ttsUrl`, played
// with expo-audio); if there is neither, the chime alone — and Settings
// says "This phone has no Urdu voice". Never throws; one at a time.
// TODO(API_VOICE): the API's clip (docs/VOICE_ASSUMED.md §5) is null in the dummy API.

import * as Speech from 'expo-speech';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import type { Announcement } from '../types/kitchen';

export type SpokenLanguage = 'ur' | 'en';
export type AnnounceOutcome = 'spoken' | 'played' | 'no_voice' | 'failed';

const LOCALE: Record<SpokenLanguage, string> = { ur: 'ur-PK', en: 'en-US' };
/** Wait for the chime's first ring before speaking over it. */
export const AFTER_CHIME_MS = 1600;
/** How long to wait for the voices list (browsers load it lazily). */
const VOICES_TIMEOUT_MS = 1500;

let voices: Speech.Voice[] | null = null;
let player: AudioPlayer | null = null;
let queue: Promise<unknown> = Promise.resolve();

const loadVoices = async (): Promise<Speech.Voice[]> => {
  if (voices?.length) return voices;
  try {
    const list = await Promise.race([Speech.getAvailableVoicesAsync(), new Promise<Speech.Voice[]>(r => setTimeout(() => r([]), VOICES_TIMEOUT_MS))]);
    voices = list;
    return list;
  } catch {
    return [];
  }
};

/** The device's voice for a language, if it has one. */
export const voiceFor = async (lang: SpokenLanguage): Promise<Speech.Voice | null> => {
  const list = await loadVoices();
  const exact = list.find(v => v.language?.toLowerCase().replace('_', '-') === LOCALE[lang].toLowerCase());
  return exact ?? list.find(v => v.language?.toLowerCase().startsWith(lang)) ?? null;
};

/** Settings asks before the kitchen relies on Urdu. English is always assumed available. */
export const hasDeviceVoice = async (lang: SpokenLanguage) => lang === 'en' || !!(await voiceFor(lang));

const speak = (text: string, lang: SpokenLanguage, voice: Speech.Voice | null) =>
  new Promise<AnnounceOutcome>(resolve => {
    try {
      Speech.speak(text, {
        language: voice?.language ?? LOCALE[lang],
        voice: voice?.identifier,
        rate: lang === 'ur' ? 0.92 : 0.96,
        onDone: () => resolve('spoken'),
        onStopped: () => resolve('spoken'),
        onError: () => resolve('failed'),
      });
    } catch {
      resolve('failed');
    }
  });

const play = (url: string) =>
  new Promise<AnnounceOutcome>(resolve => {
    try {
      player?.remove();
      player = createAudioPlayer({ uri: url });
      const sub = player.addListener('playbackStatusUpdate', s => {
        if (s.didJustFinish) {
          sub.remove();
          resolve('played');
        }
      });
      player.play();
    } catch {
      resolve('failed');
    }
  });

/** Says one announcement after the chime; queued behind any still speaking. */
export const announce = (a: Announcement, delayMs = AFTER_CHIME_MS): Promise<AnnounceOutcome> => {
  const run = async (): Promise<AnnounceOutcome> => {
    await new Promise(r => setTimeout(r, delayMs));
    const voice = await voiceFor(a.language);
    if (voice || a.language === 'en') return speak(a.text, a.language, voice);
    if (a.ttsUrl) return play(a.ttsUrl);
    return 'no_voice';
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next.catch(() => 'failed' as const);
};

/** Stops speech and any clip (the order was opened, or the board left). */
export const silence = () => {
  try {
    void Speech.stop();
    player?.pause();
  } catch {
    /* nothing playing */
  }
};

/** Tests: forget the voices list. */
export const resetAnnouncer = () => {
  voices = null;
  queue = Promise.resolve();
};
