// ═══════════════════════════════════════════════════════
// MetroMatrix — Share plain text (a prep sheet, a shopping list)
// ═══════════════════════════════════════════════════════
// The phone's share sheet (WhatsApp, SMS); in a browser, the system share
// where there is one, else the clipboard. Says what happened so the
// screen can confirm it ("Copied"). Never throws.

import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export type ShareOutcome = 'shared' | 'copied' | 'failed';

export const shareText = async (message: string, title?: string): Promise<ShareOutcome> => {
  if (Platform.OS === 'web') {
    const nav = (globalThis as { navigator?: { share?: (d: { text: string; title?: string }) => Promise<void> } }).navigator;
    if (nav?.share) {
      try {
        await nav.share({ text: message, title });
        return 'shared';
      } catch (e) {
        // Dismissed: nothing to say. Not allowed here: copy instead.
        if ((e as { name?: string })?.name === 'AbortError') return 'failed';
      }
    }
    try {
      await Clipboard.setStringAsync(message);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  try {
    await Share.share({ message, title });
    return 'shared';
  } catch {
    return 'failed';
  }
};
