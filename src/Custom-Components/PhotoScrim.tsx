// PhotoScrim — clear at the top, the `scrim` token at the bottom, so white
// text set on a photograph stays legible whatever the photo. A legibility
// layer over imagery, never a surface (CLAUDE.md rule 8).

import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';

/**
 * `strong` darkens from the top down (the FYP's brand cards), for copy that
 * sits higher on the photo; the default keeps the photo clear up top.
 */
export const PhotoScrim: React.FC<{ strength?: 'soft' | 'strong' }> = ({ strength = 'soft' }) => {
  const { colors } = useTheme();
  const strong = strength === 'strong';
  return (
    <LinearGradient
      pointerEvents="none"
      colors={strong ? [colors.scrimFaint, colors.scrimMid, colors.scrimDeep] : [colors.scrimClear, colors.scrimClear, colors.scrim]}
      locations={strong ? [0, 0.45, 1] : [0, 0.35, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
};

export default PhotoScrim;
