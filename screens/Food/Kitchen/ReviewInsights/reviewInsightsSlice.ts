// MetroMatrix — Kitchen assistant: what reviews say. A week's themes, good and
// bad, with how many reviews each and anonymised lines.

import { createAppSlice } from '../../../../store/createAppSlice';
import { getReviewInsightsAPI } from '../../../../networks/kitchen/kitchenAiNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import type { ReviewInsights } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { reviewInsightsSerializer } from '../../../../serializers/kitchen/assistantSerializer';

export interface ReviewInsightsSliceState {
  data: ReviewInsights | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: ReviewInsightsSliceState = { data: null, status: 'idle', error: NO_ERROR };

export const reviewInsightsSlice = createAppSlice({
  name: 'reviewInsights',
  initialState,
  reducers: create => ({
    loadReviewInsightsAsync: create.asyncThunk(
      async (week: string | null, { rejectWithValue }) => {
        try {
          return required(reviewInsightsSerializer(await getReviewInsightsAPI(week)));
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
          state.data = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The review themes didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectReviewInsights: state => state,
  },
});

export const { loadReviewInsightsAsync } = reviewInsightsSlice.actions;
export const { selectReviewInsights } = reviewInsightsSlice.selectors;
