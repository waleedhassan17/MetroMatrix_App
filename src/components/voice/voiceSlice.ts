// ═══════════════════════════════════════════════════════
// MetroMatrix — Voice entry: one run per context (board, stock, purchases,
// Today, search, pantry)
// ═══════════════════════════════════════════════════════
// A clip is uploaded (media purpose voice_clip) and interpreted; typed words
// are interpreted as they are. The result is a draft the screen confirms
// through its own slice — this slice never acts on it. Account-scoped (a
// sign-out clears it).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import { uploadImage } from '../../services/mediaUpload';
import { interpretVoiceAPI } from '../../networks/ai/voiceNetwork';
import { NO_ERROR, readRejection, type ServerError } from '../../screens/Auth/shared/formStatus';
import type { Clip } from '../../services/voice/recorderShared';
import type { VoiceContext, VoiceLanguage, VoiceResult } from '../../types/kitchen';
import { voiceResultSerializer } from '../../serializers/ai/voiceSerializer';

export interface VoiceRun {
  status: 'idle' | 'working' | 'result' | 'failed';
  result: VoiceResult | null;
  error: ServerError;
  /** The "Type instead" field is open. */
  typing: boolean;
  typed: string;
}

export type VoiceSliceState = Partial<Record<VoiceContext, VoiceRun>>;

export const IDLE_RUN: VoiceRun = { status: 'idle', result: null, error: NO_ERROR, typing: false, typed: '' };

const runOf = (state: VoiceSliceState, context: VoiceContext): VoiceRun => {
  if (!state[context]) state[context] = { ...IDLE_RUN };
  return state[context]!;
};

const initialState: VoiceSliceState = {};

export const voiceSlice = createAppSlice({
  name: 'voice',
  initialState,
  reducers: create => ({
    clearVoice: create.reducer((state, action: PayloadAction<VoiceContext>) => {
      state[action.payload] = { ...IDLE_RUN };
    }),
    setVoiceTyping: create.reducer((state, action: PayloadAction<{ context: VoiceContext; typing: boolean }>) => {
      const r = runOf(state, action.payload.context);
      r.typing = action.payload.typing;
      if (action.payload.typing) r.error = NO_ERROR;
    }),
    setVoiceTyped: create.reducer((state, action: PayloadAction<{ context: VoiceContext; text: string }>) => {
      runOf(state, action.payload.context).typed = action.payload.text.slice(0, 300);
    }),
    interpretClipAsync: create.asyncThunk(
      async ({ context, language, clip }: { context: VoiceContext; language: VoiceLanguage; clip: Clip }, { rejectWithValue }) => {
        try {
          const uploaded = await uploadImage(clip, 'voice_clip');
          return required(voiceResultSerializer(await interpretVoiceAPI({ context, language, audioUrl: uploaded.url, durationMs: clip.durationMs })));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const r = runOf(state, action.meta.arg.context);
          r.status = 'working';
          r.error = NO_ERROR;
          r.result = null;
        },
        fulfilled: (state, action) => {
          const r = runOf(state, action.meta.arg.context);
          r.status = 'result';
          r.result = action.payload;
        },
        rejected: (state, action) => {
          const r = runOf(state, action.meta.arg.context);
          r.status = 'failed';
          r.error = readRejection(action, "We couldn't hear that. Try again, or type it.");
        },
      },
    ),
    interpretTextAsync: create.asyncThunk(
      async ({ context, language, text }: { context: VoiceContext; language: VoiceLanguage; text: string }, { rejectWithValue }) => {
        try {
          return required(voiceResultSerializer(await interpretVoiceAPI({ context, language, text: text.trim() })));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const r = runOf(state, action.meta.arg.context);
          r.status = 'working';
          r.error = NO_ERROR;
          r.result = null;
        },
        fulfilled: (state, action) => {
          const r = runOf(state, action.meta.arg.context);
          r.status = 'result';
          r.result = action.payload;
          r.typing = false;
          r.typed = '';
        },
        rejected: (state, action) => {
          const r = runOf(state, action.meta.arg.context);
          r.status = 'failed';
          r.error = readRejection(action, "That didn't go through. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectVoiceRun: (state, context: VoiceContext): VoiceRun => state[context] ?? IDLE_RUN,
  },
});

export const { clearVoice, setVoiceTyping, setVoiceTyped, interpretClipAsync, interpretTextAsync } = voiceSlice.actions;
export const { selectVoiceRun } = voiceSlice.selectors;
