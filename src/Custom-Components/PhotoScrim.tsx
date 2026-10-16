// PhotoScrim — clear at the top, the `scrim` token at the bottom, so white
// text set on a photograph stays legible whatever the photo. A legibility
// layer over imagery, never a surface (CLAUDE.md rule 8).

import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';

const DOWN_START = { x: 0, y: 0 };
const DOWN_END = { x: 0, y: 1 };
const RIGHT_START = { x: 0, y: 0 };
const RIGHT_END = { x: 1, y: 0 };

/**
 * `strong` darkens from the top down (the FYP's brand cards), for copy that
 * sits higher on the photo; the default keeps the photo clear up top.
 * `ground` is the Health home's soft cards: the card's own ground on the
 * photo's edge nearest the words, fading into the photo within its first
 * third (a theme token pair: the colour and the same colour at zero
 * opacity).
 */
export const PhotoScrim: React.FC<{
  strength?: 'soft' | 'strong';
  /** `right`: the ground runs in from the left edge (words left, photo right). */
  ground?: { from: string; to: string; direction?: 'down' | 'right' };
}> = ({ strength = 'soft', ground }) => {
  const { colors } = useTheme();
  const strong = strength === 'strong';
  if (ground) {
    const right = ground.direction === 'right';
    return (
      <LinearGradient
        pointerEvents="none"
        colors={[ground.from, ground.to]}
        locations={right ? [0, 0.4] : [0, 0.32]}
        start={right ? RIGHT_START : DOWN_START}
        end={right ? RIGHT_END : DOWN_END}
        style={StyleSheet.absoluteFill}
      />
    );
  }
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
