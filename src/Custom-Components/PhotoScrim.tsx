// PhotoScrim — clear at the top, the `scrim` token at the bottom, so white
// text set on a photograph stays legible whatever the photo. A legibility
// layer over imagery, never a surface (CLAUDE.md rule 8).

import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';

export const PhotoScrim: React.FC = () => {
  const { colors } = useTheme();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[colors.scrimClear, colors.scrimClear, colors.scrim]}
      locations={[0, 0.35, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
};

export default PhotoScrim;
