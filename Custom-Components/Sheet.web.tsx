// ═══════════════════════════════════════════════════════
// Sheet on web — the same bottom sheet, as a Modal
// ═══════════════════════════════════════════════════════
// @gorhom/bottom-sheet never presents in a browser, which left every picker
// (city, specialty, document source) dead on web. ModalSheet has the same
// props: a scrim that dismisses, a panel anchored to the bottom (centred and
// capped in width on a wide window), the handle, title, close, body and footer.

import { ModalSheet } from './ModalSheet';

export type { SheetProps } from './sheetShared';

export const Sheet = ModalSheet;

export default Sheet;
