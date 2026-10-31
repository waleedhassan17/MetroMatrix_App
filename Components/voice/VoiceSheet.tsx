// MetroMatrix — a mic in a header: a small button that opens voice entry in
// a sheet (the board, where there is no room for the full mic).

import React, { useState } from 'react';
import { IconButton, Sheet } from '../../Custom-Components';
import { OnGradientContext } from '../../Custom-Components/headerInk';
import { VoiceEntry, type VoiceEntryProps } from './VoiceEntry';

export const VoiceSheetButton: React.FC<VoiceEntryProps & { title?: string }> = ({ title = 'Speak', onConfirm, ...rest }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Screen readers hear what can be said here (the sheet's title), not just "mic". */}
      <IconButton icon="mic-outline" onPress={() => setOpen(true)} accessibilityLabel={title === 'Speak' ? 'Speak instead of tapping' : title} />
      {/* The button sits on the gradient header; its sheet is an ordinary white surface. */}
      <OnGradientContext.Provider value={false}>
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
      </OnGradientContext.Provider>
    </>
  );
};

export default VoiceSheetButton;
