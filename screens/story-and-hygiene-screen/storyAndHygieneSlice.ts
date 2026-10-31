// MetroMatrix — Kitchen growth: the kitchen's story and its hygiene
// checklist. The story form (text, the cook's name, photos, one short
// video, uploaded first), each checklist item with optional evidence, and
// asking MetroMatrix to verify it.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { getHygieneAPI, getStoryAPI, requestHygieneVerificationAPI, saveStoryAPI, setHygieneItemAPI } from '../../networks/foodGrowth/storyNetwork';
import { uploadImage } from '../../services/mediaUpload';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import type { Hygiene, KitchenStory, LocalFile } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { storySerializer, hygieneSerializer } from '../../serializers/kitchen/reachSerializer';

export type StoryForm = Pick<KitchenStory, 'text' | 'cookName' | 'photoUrls' | 'videoUrl'>;

export interface StoryAndHygieneSliceState {
  story: KitchenStory | null;
  form: StoryForm;
  hygiene: Hygiene | null;
  status: FormStatus;
  error: ServerError;
  saving: boolean;
  saveError: ServerError;
  /** What is uploading: a story photo, the video, or a checklist item's key. */
  uploading: string | null;
  /** The checklist item being saved. */
  ticking: string | null;
  requesting: boolean;
  actionError: ServerError;
}

const EMPTY_FORM: StoryForm = { text: '', cookName: '', photoUrls: [], videoUrl: null };

const initialState: StoryAndHygieneSliceState = {
  story: null,
  form: EMPTY_FORM,
  hygiene: null,
  status: 'idle',
  error: NO_ERROR,
  saving: false,
  saveError: NO_ERROR,
  uploading: null,
  ticking: null,
  requesting: false,
  actionError: NO_ERROR,
};

const formOf = (s: KitchenStory): StoryForm => ({ text: s.text, cookName: s.cookName, photoUrls: s.photoUrls, videoUrl: s.videoUrl });

export const storyAndHygieneSlice = createAppSlice({
  name: 'storyAndHygiene',
  initialState,
  reducers: create => ({
    setStoryField: create.reducer((state, action: PayloadAction<Partial<StoryForm>>) => {
      state.form = { ...state.form, ...action.payload };
      state.saveError = NO_ERROR;
    }),
    removeStoryPhoto: create.reducer((state, action: PayloadAction<string>) => {
      state.form.photoUrls = state.form.photoUrls.filter(u => u !== action.payload);
    }),
    loadStoryAndHygieneAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [story, hygiene] = await Promise.all([getStoryAPI().then(raw => required(storySerializer(raw))), getHygieneAPI().then(raw => required(hygieneSerializer(raw)))]);
          return { story, hygiene };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          // An edit in progress isn't thrown away by a refresh.
          const untouched = !state.story || JSON.stringify(state.form) === JSON.stringify(formOf(state.story));
          state.story = action.payload.story;
          if (untouched) state.form = formOf(action.payload.story);
          state.hygiene = action.payload.hygiene;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your story didn't load.");
        },
      },
    ),
    uploadStoryMediaAsync: create.asyncThunk(
      async ({ file }: { file: LocalFile; kind: 'photo' | 'video' }, { rejectWithValue }) => {
        try {
          return (await uploadImage(file, 'food_story')).url;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.uploading = action.meta.arg.kind;
          state.saveError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.uploading = null;
          if (action.meta.arg.kind === 'video') state.form.videoUrl = action.payload;
          else state.form.photoUrls = [...state.form.photoUrls, action.payload];
        },
        rejected: (state, action) => {
          state.uploading = null;
          state.saveError = readRejection(action, "That didn't upload.");
        },
      },
    ),
    saveStoryAsync: create.asyncThunk(
      async (form: StoryForm, { rejectWithValue }) => {
        try {
          return required(storySerializer(await saveStoryAPI({ text: form.text.trim(), cookName: form.cookName.trim(), photoUrls: form.photoUrls, videoUrl: form.videoUrl })));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.saveError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.saving = false;
          state.story = action.payload;
          state.form = formOf(action.payload);
        },
        rejected: (state, action) => {
          state.saving = false;
          state.saveError = readRejection(action, "Your story didn't save.");
        },
      },
    ),
    /** Tick or untick an item; with a photo, it is uploaded first as its evidence. */
    setHygieneItemAsync: create.asyncThunk(
      async ({ key, done, file }: { key: string; done: boolean; file?: LocalFile }, { rejectWithValue }) => {
        try {
          const evidenceUrl = file ? (await uploadImage(file, 'hygiene_evidence')).url : undefined;
          return required(hygieneSerializer(await setHygieneItemAPI(key, { done, ...(evidenceUrl ? { evidenceUrl } : null) })));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.ticking = action.meta.arg.key;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.ticking = null;
          state.hygiene = action.payload;
        },
        rejected: (state, action) => {
          state.ticking = null;
          state.actionError = readRejection(action, "That didn't save.");
        },
      },
    ),
    requestVerificationAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(hygieneSerializer(await requestHygieneVerificationAPI()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.requesting = true;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.requesting = false;
          state.hygiene = action.payload;
        },
        rejected: (state, action) => {
          state.requesting = false;
          state.actionError = readRejection(action, "The request didn't send.");
        },
      },
    ),
  }),
  selectors: {
    selectStoryAndHygiene: state => state,
  },
});

export const { setStoryField, removeStoryPhoto, loadStoryAndHygieneAsync, uploadStoryMediaAsync, saveStoryAsync, setHygieneItemAsync, requestVerificationAsync } = storyAndHygieneSlice.actions;
export const { selectStoryAndHygiene } = storyAndHygieneSlice.selectors;
