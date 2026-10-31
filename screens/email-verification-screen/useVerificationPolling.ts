// The Email Verification screen's quiet re-check while it is focused: a timer
// chain (not an interval) so each wait follows the back-off in
// emailVerificationSlice, plus a check whenever the app returns to the
// foreground — the person was just in their mail app. It stops on blur,
// unmount and once verified. The slice's in-flight guard keeps the two
// triggers from overlapping.

import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppDispatch } from '../../hooks/useReduxHooks';
import { checkVerifiedAsync, nextPollDelay } from './emailVerificationSlice';

export const useVerificationPolling = (failures: number, verified: boolean) => {
  const dispatch = useAppDispatch();
  // Read by the timer when it schedules the next wait.
  const failuresRef = useRef(failures);
  useEffect(() => {
    failuresRef.current = failures;
  }, [failures]);

  useFocusEffect(
    useCallback(() => {
      if (verified) return undefined;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let live = true;
      const schedule = () => {
        timer = setTimeout(async () => {
          await dispatch(checkVerifiedAsync({ silent: true }));
          if (live) schedule();
        }, nextPollDelay(failuresRef.current));
      };
      schedule();
      const sub = AppState.addEventListener('change', next => {
        if (next === 'active') void dispatch(checkVerifiedAsync({ silent: true }));
      });
      return () => {
        live = false;
        if (timer) clearTimeout(timer);
        sub.remove();
      };
    }, [dispatch, verified]),
  );
};
