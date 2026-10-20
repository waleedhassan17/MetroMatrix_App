// MetroMatrix — Kitchen assistant: today's specials. Ideas from what expires
// soonest, priced; one becomes a hidden new dish with its recipe card.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { suggestSpecials } from '@networks/kitchen/kitchenAiNetwork';
import { createMenuItem, listMenuCategories } from '@networks/food/vendor/menuNetwork';
import { saveRecipe } from '@networks/kitchen/recipesNetwork';
import { getKitchenSettings } from '@networks/kitchen/costingNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { specialItemInput, specialRecipe } from '@models/kitchen/assistantModel';
import type { DraftCategory, MenuCategory, SpecialIdea } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface AiSpecialsSliceState {
  ideas: SpecialIdea[];
  category: DraftCategory | null;
  categories: MenuCategory[];
  targetPct: number;
  /** Prices the cook typed, by idea. */
  prices: Record<string, string>;
  /** The category picked, by idea. */
  picked: Record<string, string>;
  status: FormStatus;
  error: ServerError;
  creating: string | null;
  /** Ideas already on the menu: idea → the new dish's id. */
  created: Record<string, string>;
  createError: ServerError;
}

const initialState: AiSpecialsSliceState = {
  ideas: [],
  category: null,
  categories: [],
  targetPct: 40,
  prices: {},
  picked: {},
  status: 'idle',
  error: NO_ERROR,
  creating: null,
  created: {},
  createError: NO_ERROR,
};

export const aiSpecialsSlice = createAppSlice({
  name: 'aiSpecials',
  initialState,
  reducers: create => ({
    setSpecialPrice: create.reducer((state, action: PayloadAction<{ id: string; value: string }>) => {
      state.prices[action.payload.id] = action.payload.value;
    }),
    pickSpecialCategory: create.reducer((state, action: PayloadAction<{ id: string; categoryId: string }>) => {
      state.picked[action.payload.id] = action.payload.categoryId;
    }),
    suggestSpecialsAsync: create.asyncThunk(
      async (ingredientIds: string[] | undefined, { rejectWithValue }) => {
        try {
          const [ideas, categories, settings] = await Promise.all([suggestSpecials(ingredientIds), listMenuCategories(), getKitchenSettings()]);
          return { ...ideas, categories, targetPct: settings.targetFoodCostPct };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
          state.createError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.ideas = action.payload.items;
          state.category = action.payload.category;
          state.categories = action.payload.categories;
          state.targetPct = action.payload.targetPct;
          state.prices = Object.fromEntries(action.payload.items.map(i => [i.id, String(i.suggestedPrice)]));
          state.picked = {};
          state.created = {};
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The ideas didn't come.");
        },
      },
    ),
    /** The ordinary routes: a new dish (hidden), then its recipe card. */
    createSpecialAsync: create.asyncThunk(
      async ({ idea, categoryId, price }: { idea: SpecialIdea; categoryId: string; price: number }, { rejectWithValue }) => {
        try {
          const item = await createMenuItem(specialItemInput(idea, categoryId, price), []);
          await saveRecipe(item.id, null, specialRecipe(idea));
          return item;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.creating = action.meta.arg.idea.id;
          state.createError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.creating = null;
          state.created[action.meta.arg.idea.id] = action.payload.id;
        },
        rejected: (state, action) => {
          state.creating = null;
          state.createError = readRejection(action, "The dish wasn't added.");
        },
      },
    ),
  }),
  selectors: {
    selectAiSpecials: state => state,
  },
});

export const { setSpecialPrice, pickSpecialCategory, suggestSpecialsAsync, createSpecialAsync } = aiSpecialsSlice.actions;
export const { selectAiSpecials } = aiSpecialsSlice.selectors;
