// ═══════════════════════════════════════════════════════
// MetroMatrix — Leaving a form with unsaved changes asks first
// ═══════════════════════════════════════════════════════
// Back, the hardware back button and a swipe all remove the screen; while
// `dirty` (and nothing is saving), that asks "Discard your changes?" first.
// The doctor's long forms use it (profile, prescription, weekly hours).

import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Alert } from '../utils/alert/alert';

export const useUnsavedGuard = (dirty: boolean, saving = false) => {
  const navigation = useNavigation();
  useEffect(
    () =>
      navigation.addListener('beforeRemove', e => {
        if (!dirty || saving) return;
        e.preventDefault();
        Alert.alert('Discard your changes?', 'What you changed here hasn’t been saved.', [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]);
      }),
    [navigation, dirty, saving],
  );
};
