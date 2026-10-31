// MetroMatrix — Kitchen assistant: combo ideas. Dishes ordered together,
// at one price; one becomes a deal on the menu.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { suggestCombos } from '../../networks/kitchen/kitchenAi';
import { createMenuItem } from '../../networks/food/vendor/menu';
import { fetchKitchenSettings } from '../../networks/kitchen/costing';
import { toRejectedValue, required } from '../../networks/network/network';
import { comboItemInput } from '../../models/kitchen/assistantModel';
import type { ComboIdea, DraftCategory } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { vendorMenuItemSerializer } from '../../serializers/food/menuSerializer';
import { comboIdeasSerializer } from '../../serializers/kitchen/assistantSerializer';
import { kitchenSettingsSerializer } from '../../serializers/kitchen/recipeSerializer';

export interface AiCombosSliceState {
  ideas: ComboIdea[];
  category: DraftCategory | null;
  targetPct: number;
  prices: Record<string, string>;
  status: FormStatus;
  error: ServerError;
  creating: string | null;
  created: Record<string, string>;
  createError: ServerError;
}

const initialState: AiCombosSliceState = { ideas: [], category: null, targetPct: 40, prices: {}, status: 'idle', error: NO_ERROR, creating: null, created: {}, createError: NO_ERROR };

export const aiCombosSlice = createAppSlice({
  name: 'aiCombos',
  initialState,
  reducers: create => ({
    setComboPrice: create.reducer((state, action: PayloadAction<{ id: string; value: string }>) => {
      state.prices[action.payload.id] = action.payload.value;
    }),
    suggestCombosAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [ideas, settings] = await Promise.all([suggestCombos().then(raw => required(comboIdeasSerializer(raw))), fetchKitchenSettings().then(raw => required(kitchenSettingsSerializer(raw)))]);
          return { ...ideas, targetPct: settings.targetFoodCostPct };
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
          state.targetPct = action.payload.targetPct;
          state.prices = Object.fromEntries(action.payload.items.map(i => [i.id, String(i.bundlePrice)]));
          state.created = {};
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The ideas didn't come.");
        },
      },
    ),
    /** The ordinary route: a deal on the menu at the bundle price. */
    createComboAsync: create.asyncThunk(
      async ({ idea, categoryId, price }: { idea: ComboIdea; categoryId: string; price: number }, { rejectWithValue }) => {
        try {
          return required(vendorMenuItemSerializer(await createMenuItem(comboItemInput(idea, categoryId, price), [])));
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
          state.createError = readRejection(action, "The deal wasn't added.");
        },
      },
    ),
  }),
  selectors: {
    selectAiCombos: state => state,
  },
});

export const { setComboPrice, suggestCombosAsync, createComboAsync } = aiCombosSlice.actions;
export const { selectAiCombos } = aiCombosSlice.selectors;
