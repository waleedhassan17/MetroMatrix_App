// ═══════════════════════════════════════════════════════
// AmbientGlow — soft radial light behind a hero (ported from the FYP)
// ═══════════════════════════════════════════════════════
// Light falling on the page, not a shape sitting on it: alpha stops, so the
// glow fades to nothing at its edge. Decorative only — it carries no text and
// is not a surface.

import React, { useId } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

export interface AmbientGlowProps {
  size: number;
  /** Centre colour. */
  color: string;
  /** Colour the falloff fades through. Defaults to `color`. */
  edge?: string;
  /** Opacity at the centre. The middle stop is a third of it. */
  strength?: number;
  style?: StyleProp<ViewStyle>;
}

const AmbientGlow: React.FC<AmbientGlowProps> = ({ size, color, edge, strength = 0.16, style }) => {
  // Several glows can be mounted at once (one per onboarding slide); on web
  // the gradient id is document-wide, so each needs its own. useId's colons
  // are not valid inside url(#…).
  const id = `glow${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const r = size / 2;
  return (
    <Svg width={size} height={size} style={style} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={strength} />
          <Stop offset="0.55" stopColor={edge ?? color} stopOpacity={strength / 3} />
          <Stop offset="1" stopColor={edge ?? color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill={`url(#${id})`} />
    </Svg>
  );
};

export default AmbientGlow;
