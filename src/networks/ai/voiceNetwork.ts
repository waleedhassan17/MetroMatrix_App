// MetroMatrix — Voice: a recording (or typed words) → one proposed action.
// The clip is uploaded first (media purpose voice_clip), then interpreted;
// the answer is a draft the person confirms, after which the screen calls
// the ordinary endpoint. docs/VOICE_ASSUMED.md (TODO(API_VOICE)).

import { api } from '../network/apiHelpers';
import { clean, request } from '../shopping/http';
import { voiceResultSerializer } from '../../serializers/ai/voiceSerializer';
import type { VoiceContext, VoiceLanguage } from '../../types/kitchen';

export interface VoiceInput {
  context: VoiceContext;
  language: VoiceLanguage;
  audioUrl?: string;
  durationMs?: number;
  text?: string;
}

export const interpretVoice = (input: VoiceInput) => request(() => api.post('/ai/voice/interpret', clean({ ...input })), voiceResultSerializer);
