// ═══════════════════════════════════════════════════════
// TextField — the FYP's auth input
// ═══════════════════════════════════════════════════════
// Label above (14 / 500), a 56 pt white field with a hairline border, radius
// 12, a barely-there shadow, an Ionicons glyph on the left and the eye toggle
// on password fields; helper or error below. Focus draws the accent border.
//
// Modes:
//   text / email / numeric — the obvious keyboards and autofill hints
//   password — secure entry with a reveal toggle
//   phone    — a fixed "+92" prefix; the field holds the 10-digit national
//              number only (a typed leading 0 or 92 is dropped)
//
// forwardRef exposes the TextInput so forms can move focus to the next field.

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
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { IonIcon, type IonName } from './Icon';

export type TextFieldMode = 'text' | 'email' | 'password' | 'phone' | 'numeric';

export interface TextFieldProps
  extends Omit<TextInputProps, 'style' | 'placeholderTextColor' | 'secureTextEntry' | 'onChangeText'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  mode?: TextFieldMode;
  helper?: string;
  error?: string;
  /** Ionicons glyph inside the field, on the left (the FYP's mail-outline …). */
  icon?: IonName;
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

const makeStyles = ({ colors, space, radius, size, type, elevation }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s8 },
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: size.control.lg,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      paddingHorizontal: space.s16,
      gap: space.s12,
      ...elevation.input,
    },
    multiline: { alignItems: 'flex-start', paddingVertical: space.s12 },
    input: {
      flex: 1,
      ...type.input,
      color: colors.ink,
      paddingVertical: space.s12,
      // Web: no browser focus ring; the field's accent border is the ring.
      // 'solid' at 0 px, because Chrome paints `auto` rings at any width.
      outlineWidth: 0,
      outlineStyle: 'solid',
    },
    prefix: {
      paddingRight: space.s12,
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
      icon,
      clearable = false,
      containerStyle,
      editable = true,
      multiline,
      onFocus,
      onBlur,
      accessibilityLabel,
      ...rest
    },
    ref,
  ) => {
    const styles = useStyles(makeStyles);
    const { colors, service, opacity, maxFontScale } = useTheme();
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

    const borderColor = error ? colors.danger : focused ? service.accent : colors.line;

    return (
      <View style={[styles.root, containerStyle]}>
        <AppText variant="label" tone={error ? 'danger' : 'ink'}>
          {label}
        </AppText>
        <View
          style={[
            styles.box,
            multiline && styles.multiline,
            { borderColor },
            !editable && { opacity: opacity.disabled },
          ]}>
          {icon ? <IonIcon name={icon} size="md" color={colors.inkMuted} /> : null}
          {mode === 'phone' ? (
            <View style={styles.prefix}>
              <AppText variant="input" tone="muted">
                +92
              </AppText>
            </View>
          ) : null}
          <TextInput
            ref={ref}
            value={value}
            onChangeText={text => onChangeText(mode === 'phone' ? sanitizePkNational(text) : text)}
            editable={editable}
            multiline={multiline}
            secureTextEntry={mode === 'password' && !revealed}
            placeholderTextColor={colors.inkFaint}
            selectionColor={service.accent}
            cursorColor={service.accent}
            maxFontSizeMultiplier={maxFontScale}
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
            <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Clear ${label}`}>
              <IonIcon name="close-circle" size="md" color={colors.inkFaint} />
            </Pressable>
          ) : null}
          {mode === 'password' ? (
            <Pressable
              onPress={() => setRevealed(r => !r)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={revealed ? 'Hide password' : 'Show password'}>
              <IonIcon name={revealed ? 'eye-outline' : 'eye-off-outline'} size="md" color={colors.inkMuted} />
            </Pressable>
          ) : null}
        </View>
        {error ? (
          <View style={styles.message} accessibilityLiveRegion="polite">
            <IonIcon name="alert-circle" size="sm" color={colors.danger} />
            <AppText variant="small" tone="danger" style={{ flex: 1 }}>
              {error}
            </AppText>
          </View>
        ) : helper ? (
          <AppText variant="caption" tone="muted">
            {helper}
          </AppText>
        ) : null}
      </View>
    );
  },
);

TextField.displayName = 'TextField';

export default TextField;
