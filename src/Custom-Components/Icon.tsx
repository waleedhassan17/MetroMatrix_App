// Icon — Feather glyphs sized from the token scale.

import React from 'react';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme';

export type IconName = React.ComponentProps<typeof Feather>['name'];

export interface IconProps {
  name: IconName;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  accessibilityLabel?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 'md', color, accessibilityLabel }) => {
  const theme = useTheme();
  return (
    <Feather
      name={name}
      size={theme.size.icon[size]}
      color={color ?? theme.colors.ink}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    />
  );
};

export default Icon;
