// MetroMatrix — a mic in a header: a small button that opens voice entry in
// a sheet (the board, where there is no room for the full mic).

import React, { useState } from 'react';
import { IconButton, Sheet } from '../../Custom-Components';
import { VoiceEntry, type VoiceEntryProps } from './VoiceEntry';

export const VoiceSheetButton: React.FC<VoiceEntryProps & { title?: string }> = ({ title = 'Speak', onConfirm, ...rest }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon="mic-outline" onPress={() => setOpen(true)} accessibilityLabel="Speak instead of tapping" />
      <Sheet visible={open} onClose={() => setOpen(false)} title={title}>
        <VoiceEntry
          {...rest}
          onConfirm={async a => {
            const ok = await onConfirm(a);
            if (ok) setOpen(false);
            return ok;
          }}
        />
      </Sheet>
    </>
  );
};

export default VoiceSheetButton;
