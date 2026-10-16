// MetroMatrix — Health records filters: whose records ('self', a family member) and which type.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { RecordType } from '@/types';

export interface HealthRecordsSliceState {
  /** null = everyone; 'self' = the account holder; else a family member's id. */
  memberId: string | null;
  type: RecordType | null;
}

const initialState: HealthRecordsSliceState = { memberId: null, type: null };

export const healthRecordsSlice = createAppSlice({
  name: 'healthRecords',
  initialState,
  reducers: create => ({
    setRecordsMember: create.reducer((state, action: PayloadAction<string | null>) => {
      state.memberId = action.payload;
    }),
    setRecordsType: create.reducer((state, action: PayloadAction<RecordType | null>) => {
      state.type = action.payload;
    }),
  }),
  selectors: {
    selectRecordsFilter: state => state,
  },
});

export const { setRecordsMember, setRecordsType } = healthRecordsSlice.actions;
export const { selectRecordsFilter } = healthRecordsSlice.selectors;
