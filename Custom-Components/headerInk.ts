// MetroMatrix — "This control sits on the gradient page header."
// PageHeader provides it around its trailing actions, so an IconButton,
// CountIconButton, TextAction or Button placed there paints itself for the
// coloured ground (white glyphs, a white button) without the screen knowing
// which header its module wears.

import { createContext, useContext, useMemo } from 'react';
import type { ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export const OnGradientContext = createContext(false);

export const useOnGradient = () => useContext(OnGradientContext);

/**
 * A search field inside the gradient header, the FYP's: flat white, radius
 * 10, 16 at the sides, 44 tall, no border and no shadow. Shopping, Health and
 * Food Court's fields all take it, so they can't drift apart.
 */
export const useHeaderFieldStyle = (): ViewStyle => {
  const { colors, radius, size, space } = useTheme();
  return useMemo(
    () => ({
      height: size.touch,
      marginHorizontal: space.s0,
      paddingHorizontal: space.s16,
      borderRadius: radius.control,
      borderWidth: space.s0,
      backgroundColor: colors.surface,
    }),
    [colors.surface, radius.control, size.touch, space.s0, space.s16],
  );
};
