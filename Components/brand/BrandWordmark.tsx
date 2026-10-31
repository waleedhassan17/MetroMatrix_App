// ═══════════════════════════════════════════════════════
// BrandWordmark — "Metro" in ink, "Matrix" in the brand green (FYP)
// ═══════════════════════════════════════════════════════
// Reads the `neutral` (brand) palette directly, so it is the brand wherever
// it is mounted — inside a service's ServiceScope it would otherwise turn
// blue or orange.
//   display   the splash (34 / 700)
//   compact   a bar or a header (16 / 600), "Matrix" in accentDeep (text-safe)

import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { MAX_FONT_SCALE, SERVICE_PALETTES, useTheme } from '../../theme';

export interface BrandWordmarkProps {
  variant?: 'display' | 'compact';
  style?: StyleProp<TextStyle>;
}

const BrandWordmark: React.FC<BrandWordmarkProps> = ({ variant = 'display', style }) => {
  const { colors, type } = useTheme();
  const brand = SERVICE_PALETTES.light.neutral;
  const display = variant === 'display';
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={[display ? type.display : type.title, { color: colors.ink }, style]}
      accessibilityLabel="MetroMatrix"
      numberOfLines={1}>
      Metro
      <Text style={{ color: display ? brand.accent : brand.accentDeep }}>Matrix</Text>
    </Text>
  );
};

export default BrandWordmark;
