// ═══════════════════════════════════════════════════════
// MetroMatrix — DateField on web: the browser's own date input
// ═══════════════════════════════════════════════════════
// The community picker renders nothing in a browser, so web gets a real
// <input type="date"> behind the same props (the FYP's
// PlatformDateTimePicker.web approach). Local `YYYY-MM-DD` in and out.

import React from 'react';
import { View } from 'react-native';
import { WEB_SYSTEM_FONT, useStyles, useTheme } from '../theme';
import { AppText } from './AppText';
import { makeDateFieldStyles, type DateFieldProps } from './dateFieldShared';

export * from './dateFieldShared';

export const DateField: React.FC<DateFieldProps> = ({ label, value, onChange, min, max, error, disabled }) => {
  const styles = useStyles(makeDateFieldStyles);
  const { colors, type, space, size, radius, opacity: opacityToken } = useTheme();
  return (
    <View style={styles.root}>
      <AppText variant="label" tone={error ? 'danger' : 'ink'}>
        {label}
      </AppText>
      {React.createElement('input', {
        type: 'date',
        value,
        min,
        max,
        disabled,
        'aria-label': label,
        'aria-invalid': !!error,
        onChange: (e: { target: { value: string } }) => {
          // Chrome reports a year typed digit by digit as 0002, 0020, …
          const v = e.target.value;
          if (!v || /^[1-9]\d{3}-\d{2}-\d{2}$/.test(v)) onChange(v);
        },
        style: {
          fontFamily: WEB_SYSTEM_FONT,
          fontSize: type.input.fontSize,
          color: value ? colors.ink : colors.inkFaint,
          backgroundColor: colors.surface,
          border: `${size.border}px solid ${error ? colors.danger : colors.line}`,
          borderRadius: radius.md,
          height: size.control.lg,
          padding: `0 ${space.s16}px`,
          width: '100%',
          boxSizing: 'border-box',
          colorScheme: 'light',
          opacity: disabled ? opacityToken.disabled : 1,
        },
      })}
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
};

export default DateField;
