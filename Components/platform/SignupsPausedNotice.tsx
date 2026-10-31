// MetroMatrix — on the sign-up screens while new accounts of that kind are
// paused (GET /config, or a 403 SIGNUPS_PAUSED). Signing in still works.

import React from 'react';
import { InlineNotice } from '../../Custom-Components/InlineNotice';
import { useAppSelector } from '../../hooks/useReduxHooks';
import { selectSignupsOpen } from '../../store/platformConfigSlice';

export type SignupRole = 'customer' | 'partner';

export const useSignupsOpen = (role: SignupRole): boolean => useAppSelector(state => selectSignupsOpen(state, role));

export const SIGNUPS_PAUSED_MESSAGE: Record<SignupRole, string> = {
  customer: 'New accounts are paused for now. If you already have an account, you can sign in.',
  partner: 'New service provider accounts are paused for now. If you already have one, you can sign in.',
};

export const SignupsPausedNotice: React.FC<{ role: SignupRole }> = ({ role }) =>
  useSignupsOpen(role) ? null : <InlineNotice tone="info" title="Sign-ups are paused" message={SIGNUPS_PAUSED_MESSAGE[role]} />;

export default SignupsPausedNotice;
