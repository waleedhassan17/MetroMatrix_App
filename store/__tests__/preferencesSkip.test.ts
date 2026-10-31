// B9: "Skip for now" on Complete Profile is a device preference, per account,
// and survives sign-out (RESET_ALL_STATE), unlike the person's searches.

import { preferencesSlice, skipProfile } from '../preferencesSlice';
import { resetAllState } from '../resetAllState';

const { reducer } = preferencesSlice;

describe('preferences.skippedProfile', () => {
  it('records a skip per account and keeps it across sign-out', () => {
    let s = reducer(undefined, { type: '@@init' });
    expect(s.skippedProfile).toEqual({});
    s = reducer(s, skipProfile('u1'));
    s = reducer(s, skipProfile('u2'));
    expect(s.skippedProfile).toEqual({ u1: true, u2: true });
    s = reducer(s, resetAllState());
    expect(s.skippedProfile).toEqual({ u1: true, u2: true });
  });
});
