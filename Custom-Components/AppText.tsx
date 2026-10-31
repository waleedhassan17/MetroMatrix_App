// ═══════════════════════════════════════════════════════
// AppText — the only Text the UI renders
// ═══════════════════════════════════════════════════════
// A type role + a colour token. Caps dynamic type at 130% so fixed-height
// controls never clip, while still honouring the user's setting up to there.

import React from 'react';
import { Text, type TextProps } from 'react-native';
import { useTheme, type TypeRole } from '../theme';

export type TextTone =
  | 'ink'
  | 'muted'
  | 'faint'
  | 'brand'
  | 'onBrand'
  | 'accent'
  | 'accentDeep'
  | 'onAccent'
  | 'danger'
  | 'success'
  | 'warning'
  | 'onScrim'
  | 'onDanger';

export interface AppTextProps extends TextProps {
  variant?: TypeRole;
  tone?: TextTone;
  align?: 'left' | 'center' | 'right';
}

export const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  tone = 'ink',
  align,
  style,
  maxFontSizeMultiplier,
  ...rest
}) => {
  const { type, colors, service, maxFontScale } = useTheme();
  const color: Record<TextTone, string> = {
    ink: colors.ink,
    muted: colors.inkMuted,
    faint: colors.inkFaint,
    brand: colors.brand,
    onBrand: colors.onBrand,
    accent: service.accent,
    accentDeep: service.accentDeep,
    onAccent: service.onAccent,
    danger: colors.danger,
    success: colors.success,
    warning: colors.warning,
    onScrim: colors.onScrim,
    onDanger: colors.onDanger,
  };
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? maxFontScale}
      style={[type[variant], { color: color[tone] }, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
};

export default AppText;
