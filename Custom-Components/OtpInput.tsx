// ═══════════════════════════════════════════════════════
// OtpInput — six cells over one real input
// ═══════════════════════════════════════════════════════
// One hidden TextInput owns the value, so paste, SMS autofill
// (Android `autoComplete="sms-otp"`, iOS `oneTimeCode`) and backspace all
// behave natively; the cells only draw it. Typing advances by construction.
// onComplete fires once when the last digit lands.

import React, { forwardRef, useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';

export interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  accessibilityLabel?: string;
}

const makeStyles = ({ colors, size, radius, space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s8 },
    cell: {
      flex: 1,
      maxWidth: size.otpCell.width,
      height: size.otpCell.height,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hiddenInput: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0,
      color: 'transparent',
    },
  });

export const OtpInput = forwardRef<TextInput, OtpInputProps>(
  (
    {
      value,
      onChange,
      onComplete,
      length = 6,
      error = false,
      disabled = false,
      autoFocus = true,
      accessibilityLabel = 'Verification code',
    },
    ref,
  ) => {
    const styles = useStyles(makeStyles);
    const { colors, service, size, opacity } = useTheme();
    const innerRef = useRef<TextInput>(null);
    const lastCompleted = useRef('');

    const setRefs = (node: TextInput | null) => {
      (innerRef as React.MutableRefObject<TextInput | null>).current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<TextInput | null>).current = node;
    };

    useEffect(() => {
      if (value.length === length && value !== lastCompleted.current) {
        lastCompleted.current = value;
        onComplete?.(value);
      }
      if (value.length < length) lastCompleted.current = '';
    }, [value, length, onComplete]);

    const cells = Array.from({ length }, (_, i) => value[i] ?? '');
    const activeIndex = Math.min(value.length, length - 1);

    return (
      <Pressable
        onPress={() => innerRef.current?.focus()}
        accessible={false}
        style={disabled ? { opacity: opacity.disabled } : null}>
        <View style={styles.row}>
          {cells.map((digit, i) => {
            const active = !disabled && i === activeIndex && value.length < length;
            return (
              <View
                key={i}
                style={[
                  styles.cell,
                  active && { borderColor: service.accent, borderWidth: size.focusBorder },
                  error && { borderColor: colors.danger },
                ]}>
                <AppText variant="h2">{digit}</AppText>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={setRefs}
          value={value}
          onChangeText={text => onChange(text.replace(/\D/g, '').slice(0, length))}
          maxLength={length}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          autoFocus={autoFocus}
          editable={!disabled}
          caretHidden
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={`${length}-digit code`}
          style={styles.hiddenInput}
        />
      </Pressable>
    );
  },
);

OtpInput.displayName = 'OtpInput';

export default OtpInput;
