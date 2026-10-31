// Spoken announcements: the phone's own voice for the language if it has one,
// else the API's recorded clip, else the chime alone ("no_voice"). English is
// always spoken. One at a time, after the chime's first ring.

const mockSpeak = jest.fn((_text: string, opts: { onDone?: () => void }) => opts.onDone?.());
let mockVoices: { identifier: string; language: string; name: string; quality: string }[] = [];
jest.mock('expo-speech', () => ({
  speak: (text: string, opts: { onDone?: () => void }) => mockSpeak(text, opts),
  stop: jest.fn(),
  getAvailableVoicesAsync: () => Promise.resolve(mockVoices),
}));
const mockPlay = jest.fn();
jest.mock('expo-audio', () => ({
  createAudioPlayer: () => {
    let listener: ((s: { didJustFinish: boolean }) => void) | null = null;
    return {
      addListener: (_e: string, l: (s: { didJustFinish: boolean }) => void) => {
        listener = l;
        return { remove: () => undefined };
      },
      play: () => {
        mockPlay();
        listener?.({ didJustFinish: true });
      },
      pause: jest.fn(),
      remove: jest.fn(),
    };
  },
}));

import { announce, hasDeviceVoice, resetAnnouncer } from '../announcer';

const ur = { orderId: 'o', text: 'نیا آرڈر', language: 'ur' as const, ttsUrl: null };

beforeEach(() => {
  mockSpeak.mockClear();
  mockPlay.mockClear();
  resetAnnouncer();
});

it('speaks Urdu with the phone’s Urdu voice', async () => {
  mockVoices = [{ identifier: 'ur-voice', language: 'ur-PK', name: 'Urdu', quality: 'Default' }];
  expect(await announce(ur, 0)).toBe('spoken');
  expect(mockSpeak).toHaveBeenCalledWith('نیا آرڈر', expect.objectContaining({ language: 'ur-PK', voice: 'ur-voice' }));
  expect(await hasDeviceVoice('ur')).toBe(true);
});

it('plays the API’s clip when the phone has no Urdu voice', async () => {
  mockVoices = [{ identifier: 'en', language: 'en-US', name: 'English', quality: 'Default' }];
  expect(await announce({ ...ur, ttsUrl: 'https://cdn.example/clip.mp3' }, 0)).toBe('played');
  expect(mockPlay).toHaveBeenCalled();
  expect(mockSpeak).not.toHaveBeenCalled();
});

it('rings only when there is neither', async () => {
  mockVoices = [];
  expect(await announce(ur, 0)).toBe('no_voice');
  expect(await hasDeviceVoice('ur')).toBe(false);
});

it('always speaks English', async () => {
  mockVoices = [];
  expect(await announce({ orderId: 'o', text: 'New order', language: 'en', ttsUrl: null }, 0)).toBe('spoken');
  expect(mockSpeak).toHaveBeenCalledWith('New order', expect.objectContaining({ language: 'en-US' }));
});
