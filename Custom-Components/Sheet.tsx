// ═══════════════════════════════════════════════════════
// Sheet — a themed bottom sheet with a title: ModalSheet, on every platform
// ═══════════════════════════════════════════════════════
// Controlled by `visible` so a slice can own whether it is open. It used to be
// @gorhom/bottom-sheet on phones, which never presents in Expo Go on Android
// (and never in a browser): tapping "Add" on a provider's document did nothing
// (the owner's report of 2026-11-25), as did every other sheet there. The
// pickers had already moved to a plain React Native Modal (fix/p1); now every
// sheet is that same Modal, so one implementation opens wherever the app runs.

import { ModalSheet } from './ModalSheet';

export type { SheetProps } from './sheetShared';

export const Sheet = ModalSheet;

export default Sheet;
