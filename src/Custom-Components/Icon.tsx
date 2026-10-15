// Icon — glyphs sized from the token scale. Three sets, as the FYP app uses
// them: Feather for generic UI, Ionicons for the auth screens (mail-outline,
// lock-closed-outline, logo-google …) and MaterialCommunityIcons for the
// provider types (stethoscope, store, silverware-fork-knife …).

import React from 'react';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';

export type IconName = React.ComponentProps<typeof Feather>['name'];
export type IonName = React.ComponentProps<typeof Ionicons>['name'];
export type MciName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type IconSize = 'sm' | 'md' | 'lg' | 'xl' | 'hero';

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

export const Icon: React.FC<BaseProps & { name: IconName }> = ({ name, size = 'md', color, accessibilityLabel }) => {
  const theme = useTheme();
  return <Feather name={name} size={theme.size.icon[size]} color={color ?? theme.colors.ink} {...a11y(accessibilityLabel)} />;
};

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

export default Icon;
