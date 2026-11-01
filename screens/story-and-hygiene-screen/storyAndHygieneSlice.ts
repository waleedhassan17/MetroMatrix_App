// MetroMatrix — Kitchen growth: the kitchen's story and its hygiene
// checklist, one record in the API. The story form (text, the cook's name,
// photos, one short video, uploaded first) and the checklist's ticks: every
// save sends both whole. A complete checklist is self-declared at once;
// staff verify it after a visit or a video call.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchStory, saveStory } from '../../networks/foodGrowth/story';
import { uploadImage } from '../../services/mediaUpload';
import { toRejectedValue } from '../../networks/network/network';
import type { Hygiene, KitchenStory, LocalFile } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { storySerializer, hygieneSerializer, hygieneChecklistOf } from '../../serializers/kitchen/reachSerializer';
import { PKT, todayInZone } from '../../utils/health-time/healthTime';

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
          return await fetchStory();
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
          const payload = { story: storySerializer(action.payload), hygiene: hygieneSerializer(action.payload) };
          state.status = 'succeeded';
          // An edit in progress isn't thrown away by a refresh.
          const untouched = !state.story || JSON.stringify(state.form) === JSON.stringify(formOf(state.story));
          state.story = payload.story;
          if (untouched) state.form = formOf(payload.story);
          state.hygiene = payload.hygiene;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your story didn't load.");
        },
      },
    ),
    uploadStoryMediaAsync: create.asyncThunk(
      async ({ file, kind }: { file: LocalFile; kind: 'photo' | 'video' }, { rejectWithValue }) => {
        try {
          return (await uploadImage(file, kind === 'video' ? 'food_story_video' : 'food_story')).url;
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
      async (form: StoryForm, { getState, rejectWithValue }) => {
        const hygiene = (getState() as { storyAndHygiene: StoryAndHygieneSliceState }).storyAndHygiene.hygiene;
        try {
          return await saveStory({ text: form.text.trim(), cookName: form.cookName.trim(), photoUrls: form.photoUrls, videoUrl: form.videoUrl }, hygieneChecklistOf(hygiene));
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
          const payload = storySerializer(action.payload);
          state.saving = false;
          state.story = payload;
          state.form = formOf(payload);
          state.hygiene = hygieneSerializer(action.payload);
        },
        rejected: (state, action) => {
          state.saving = false;
          state.saveError = readRejection(action, "Your story didn't save.");
        },
      },
    ),
    /** Tick or untick an item (pest control: done today): the story is saved with it, as it stands. */
    setHygieneItemAsync: create.asyncThunk(
      async ({ key, done }: { key: string; done: boolean }, { getState, rejectWithValue }) => {
        const st = (getState() as { storyAndHygiene: StoryAndHygieneSliceState }).storyAndHygiene;
        const checklist = hygieneChecklistOf(st.hygiene);
        const next = key === 'pestControlOn' ? { ...checklist, pestControlOn: done ? todayInZone(PKT) : null } : { ...checklist, [key]: done };
        const story = st.story ?? { text: '', cookName: '', photoUrls: [], videoUrl: null };
        try {
          return await saveStory({ text: story.text, cookName: story.cookName, photoUrls: story.photoUrls, videoUrl: story.videoUrl }, next);
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
          state.hygiene = hygieneSerializer(action.payload);
        },
        rejected: (state, action) => {
          state.ticking = null;
          state.actionError = readRejection(action, "That didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectStoryAndHygiene: state => state,
  },
});

export const { setStoryField, removeStoryPhoto, loadStoryAndHygieneAsync, uploadStoryMediaAsync, saveStoryAsync, setHygieneItemAsync } = storyAndHygieneSlice.actions;
export const { selectStoryAndHygiene } = storyAndHygieneSlice.selectors;
