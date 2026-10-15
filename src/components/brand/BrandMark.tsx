// ═══════════════════════════════════════════════════════
// BrandMark — the MetroMatrix logo tile (ported from the FYP)
// ═══════════════════════════════════════════════════════
// assets/images/splash-mark.png is exactly what app.json hands the native
// splash, at the same width (size.splashMark). The JS splash paints this same
// file at the same size in the window's centre, so the launch hands off
// native → JS without the mark moving or changing.

import React from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

export interface BrandMarkProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const BrandMark: React.FC<BrandMarkProps> = ({ size, style }) => {
  const theme = useTheme();
  const side = size ?? theme.size.splashMark;
  const box = { width: side, height: side };
  return (
    <View style={[box, style]} accessibilityRole="image" accessibilityLabel="MetroMatrix logo">
      <Image
        source={require('../../../assets/images/splash-mark.png')}
        style={box}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
};

export default BrandMark;
