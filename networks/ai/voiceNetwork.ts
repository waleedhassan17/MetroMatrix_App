// ═══════════════════════════════════════════════════════
// MetroMatrix — Ai Voice Network (VOICE_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// A recording (or typed words) → one proposed action.
// The clip is uploaded first (media purpose voice_clip), then interpreted;
// the answer is a draft the person confirms, after which the screen calls
// the ordinary endpoint. docs/VOICE_ASSUMED.md (TODO(API_VOICE)).

import { api, toApiError, clean } from '../network/apiHelpers';
import type { VoiceContext, VoiceLanguage } from '../../models/kitchen';

export interface VoiceInput {
  context: VoiceContext;
  language: VoiceLanguage;
  audioUrl?: string;
  durationMs?: number;
  text?: string;
}

export const interpretVoiceAPI = async (input: VoiceInput): Promise<unknown> => {
  try {
    const response = await api.post('/ai/voice/interpret', clean({ ...input }));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
