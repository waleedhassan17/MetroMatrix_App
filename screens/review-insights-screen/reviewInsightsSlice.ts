// MetroMatrix — Kitchen assistant: what reviews say. A week's themes, good and
// bad, with how many reviews each and anonymised lines.

import { createAppSlice } from '../../store/createAppSlice';
import { fetchReviewInsights } from '../../networks/kitchen/kitchenAi';
import { toRejectedValue } from '../../networks/network/network';
import type { ReviewInsights } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { reviewInsightsSerializer } from '../../serializers/kitchen/assistantSerializer';

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
          return await fetchReviewInsights(week);
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
          const payload = reviewInsightsSerializer(action.payload);
          state.status = 'succeeded';
          state.data = payload;
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
