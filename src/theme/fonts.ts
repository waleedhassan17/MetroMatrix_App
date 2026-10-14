// The useFonts map for App.tsx. Per-weight subpath imports so only the five
// faces the type scale names are bundled, not every weight of the family.

import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
import { FONT_FACES } from './typography';

export const FONT_MAP = {
  [FONT_FACES.sans400]: PlusJakartaSans_400Regular,
  [FONT_FACES.sans500]: PlusJakartaSans_500Medium,
  [FONT_FACES.sans600]: PlusJakartaSans_600SemiBold,
  [FONT_FACES.sans700]: PlusJakartaSans_700Bold,
  [FONT_FACES.serif400]: InstrumentSerif_400Regular,
};
