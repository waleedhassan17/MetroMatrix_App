// ═══════════════════════════════════════════════════════
// MetroMatrix — Notifications pre-prompt
// ═══════════════════════════════════════════════════════
// Asked once per device, after the first session opens, and BEFORE the OS
// dialog — a refused OS dialog cannot be asked again, so we only show it to
// people who said yes here. Later sessions re-register silently.

import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { selectPushPromptSeen, setPushPromptSeen } from '../../store/preferencesSlice';
import { isPushSupported } from '../../services/push';
import { AppText, Button, Sheet } from '../../Custom-Components';
import { registerPushAsync } from './appContainerSlice';

export const PushPrePrompt: React.FC<{ active: boolean }> = ({ active }) => {
  const dispatch = useAppDispatch();
  const seen = useAppSelector(selectPushPromptSeen);
  const [open, setOpen] = useState(false);
  const supported = isPushSupported();

  useEffect(() => {
    if (!active || !supported) return;
    if (seen) {
      dispatch(registerPushAsync({ ask: false }));
      return;
    }
    // Let the app's first screen settle before asking.
    const id = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(id);
  }, [active, seen, supported, dispatch]);

  const answer = (allow: boolean) => {
    setOpen(false);
    dispatch(setPushPromptSeen());
    if (allow) dispatch(registerPushAsync({ ask: true }));
  };

  if (!active || !supported) return null;
  return (
    <Sheet
      visible={open}
      onClose={() => answer(false)}
      title="Stay in the loop"
      subtitle="Order updates, appointment reminders and approval news."
      footer={
        <>
          <Button label="Turn on notifications" onPress={() => answer(true)} fullWidth />
          <Button label="Not now" variant="ghost" onPress={() => answer(false)} />
        </>
      }>
      <AppText variant="small" tone="muted">
        {"You can change this any time in your phone's settings."}
      </AppText>
    </Sheet>
  );
};

export default PushPrePrompt;
