// ═══════════════════════════════════════════════════════
// TextField — label above, helper/error below
// ═══════════════════════════════════════════════════════
// Modes:
//   text / email / numeric — the obvious keyboards and autofill hints
//   password — secure entry with a reveal toggle
//   phone    — a fixed "+92" prefix; the field holds the 10-digit national
//              number only (a typed leading 0 or 92 is dropped), so the model
//              composes "+92" + value and never sees ambiguous input
//
// forwardRef exposes the TextInput so forms can move focus to the next field
// on "next" and submit on the last.

import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useStyles, useTheme, MAX_FONT_SCALE, type Theme } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type TextFieldMode = 'text' | 'email' | 'password' | 'phone' | 'numeric';

export interface TextFieldProps
  extends Omit<TextInputProps, 'style' | 'placeholderTextColor' | 'secureTextEntry' | 'onChangeText'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  mode?: TextFieldMode;
  helper?: string;
  error?: string;
  leftIcon?: IconName;
  clearable?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

/** Keep only the national part of a Pakistani number typed after "+92". */
export const sanitizePkNational = (raw: string): string => {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('92')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
};

const makeStyles = ({ colors, space, radius, size, type }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s8 },
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: size.control.md,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderColor: colors.lineStrong,
      backgroundColor: colors.surface,
      paddingHorizontal: space.s12,
      gap: space.s8,
    },
    input: {
      flex: 1,
      ...type.body,
      color: colors.ink,
      paddingVertical: space.s12,
    },
    prefix: {
      paddingRight: space.s8,
      borderRightWidth: size.border,
      borderRightColor: colors.line,
    },
    message: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  });

export const TextField = forwardRef<TextInput, TextFieldProps>(
  (
    {
      label,
      value,
      onChangeText,
      mode = 'text',
      helper,
      error,
      leftIcon,
      clearable = false,
      containerStyle,
      editable = true,
      onFocus,
      onBlur,
      accessibilityLabel,
      ...rest
    },
    ref,
  ) => {
    const styles = useStyles(makeStyles);
    const { colors, service, opacity } = useTheme();
    const [focused, setFocused] = useState(false);
    const [revealed, setRevealed] = useState(false);

    const keyboard: Partial<TextInputProps> =
      mode === 'email'
        ? { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false, autoComplete: 'email', textContentType: 'emailAddress' }
        : mode === 'password'
          ? { autoCapitalize: 'none', autoCorrect: false, textContentType: 'password' }
          : mode === 'phone'
            ? { keyboardType: 'phone-pad', autoComplete: 'tel', textContentType: 'telephoneNumber' }
            : mode === 'numeric'
              ? { keyboardType: 'number-pad' }
              : {};

    const borderColor = error ? colors.danger : focused ? service.accent : colors.lineStrong;

    return (
      <View style={[styles.root, containerStyle]}>
        <AppText variant="small" tone={error ? 'danger' : focused ? 'accentDeep' : 'muted'}>
          {label}
        </AppText>
        <View style={[styles.box, { borderColor }, !editable && { opacity: opacity.disabled }]}>
          {leftIcon ? <Icon name={leftIcon} size="md" color={colors.inkFaint} /> : null}
          {mode === 'phone' ? (
            <View style={styles.prefix}>
              <AppText variant="body" tone="muted">
                +92
              </AppText>
            </View>
          ) : null}
          <TextInput
            ref={ref}
            value={value}
            onChangeText={text => onChangeText(mode === 'phone' ? sanitizePkNational(text) : text)}
            editable={editable}
            secureTextEntry={mode === 'password' && !revealed}
            placeholderTextColor={colors.inkFaint}
            selectionColor={service.accent}
            cursorColor={service.accent}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityHint={error ?? helper}
            onFocus={e => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={e => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={styles.input}
            {...keyboard}
            {...rest}
          />
          {clearable && value.length > 0 && editable ? (
            <Pressable
              onPress={() => onChangeText('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Clear ${label}`}>
              <Icon name="x-circle" size="md" color={colors.inkFaint} />
            </Pressable>
          ) : null}
          {mode === 'password' ? (
            <Pressable
              onPress={() => setRevealed(r => !r)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={revealed ? 'Hide password' : 'Show password'}>
              <Icon name={revealed ? 'eye-off' : 'eye'} size="md" color={colors.inkMuted} />
            </Pressable>
          ) : null}
        </View>
        {error ? (
          <View style={styles.message} accessibilityLiveRegion="polite">
            <Icon name="alert-circle" size="sm" color={colors.danger} />
            <AppText variant="small" tone="danger">
              {error}
            </AppText>
          </View>
        ) : helper ? (
          <AppText variant="small" tone="muted">
            {helper}
          </AppText>
        ) : null}
      </View>
    );
  },
);

TextField.displayName = 'TextField';

export default TextField;
