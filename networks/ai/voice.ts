// ═══════════════════════════════════════════════════════
// MetroMatrix — Voice Network (docs/VOICE.md)
// ═══════════════════════════════════════════════════════
// A recording (a private voice_audio upload) or typed words → a proposed
// action: the exact request the app would make. Nothing is executed; after
// the person taps Confirm, the app sends that request as it came.

import { API, toApiError, clean } from '../network/network';
import type { VoiceContext, VoiceLanguage } from '../../models/kitchen';

/** The app's screens → the API's contexts. */
const CONTEXT: Record<VoiceContext, string> = { board: 'board', today: 'today', stock: 'stock', purchases: 'purchase', search: 'menu_search', pantry: 'pantry' };

export interface VoiceInput {
  context: VoiceContext;
  language: VoiceLanguage;
  audioUrl?: string;
  publicId?: string;
  durationMs?: number;
  text?: string;
}

export const interpretVoice = async (input: VoiceInput): Promise<unknown> => {
  try {
    const data = clean({
      context: CONTEXT[input.context],
      audioUrl: input.audioUrl,
      publicId: input.publicId,
      durationSeconds: input.durationMs === undefined ? undefined : Math.max(1, Math.ceil(input.durationMs / 1000)),
      text: input.text?.trim(),
      languageHint: input.language,
    });
    const response = await API.POST({ URL: '/ai/voice', data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The proposed request, made as the server wrote it, once the person confirms. */
export const confirmVoiceAction = async (action: { method: string; path: string; body?: unknown }): Promise<unknown> => {
  try {
    const method = action.method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    const response = await API[method]({ URL: action.path, ...(method === 'GET' || method === 'DELETE' ? {} : { data: action.body ?? {} }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
