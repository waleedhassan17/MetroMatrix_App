// Which role the person picked on Role Selection — the FYP's first question.
// It decides which sign-in opens; the server decides the real role.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import type { AuthUserType } from '../../types';

export interface RoleSelectionSliceState {
  role: AuthUserType | null;
}

const initialState: RoleSelectionSliceState = { role: null };

export const roleSelectionSlice = createAppSlice({
  name: 'roleSelection',
  initialState,
  reducers: create => ({
    selectRole: create.reducer((state, action: PayloadAction<AuthUserType>) => {
      state.role = action.payload;
    }),
  }),
  selectors: {
    selectSelectedRole: state => state.role,
  },
});

export const { selectRole } = roleSelectionSlice.actions;
export const { selectSelectedRole } = roleSelectionSlice.selectors;
