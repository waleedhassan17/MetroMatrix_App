// Icon — glyphs sized from the token scale. ONE set, Ionicons, everywhere
// (one stroke and one corner style, so no screen mixes looks); the outline
// glyphs in rows and wells, a filled one only for a selected state.
// MaterialCommunityIcons only where Ionicons has no glyph at all: the
// provider types and the medical specialties (stethoscope, tooth, lungs …).
// There is no Feather.

import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';

export type IonName = React.ComponentProps<typeof Ionicons>['name'];
export type MciName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type IconSize = 'sm' | 'field' | 'md' | 'lg' | 'xl' | 'hero';

interface BaseProps {
  size?: IconSize;
  color?: string;
  accessibilityLabel?: string;
}

const a11y = (label?: string) => ({
  accessibilityLabel: label,
  accessibilityElementsHidden: !label,
  importantForAccessibility: label ? ('yes' as const) : ('no-hide-descendants' as const),
});

export const IonIcon: React.FC<BaseProps & { name: IonName }> = ({ name, size = 'md', color, accessibilityLabel }) => {
  const theme = useTheme();
  return <Ionicons name={name} size={theme.size.icon[size]} color={color ?? theme.colors.ink} {...a11y(accessibilityLabel)} />;
};

export const MciIcon: React.FC<BaseProps & { name: MciName }> = ({ name, size = 'md', color, accessibilityLabel }) => {
  const theme = useTheme();
  return (
    <MaterialCommunityIcons
      name={name}
      size={theme.size.icon[size]}
      color={color ?? theme.colors.ink}
      {...a11y(accessibilityLabel)}
    />
  );
};

export default IonIcon;
