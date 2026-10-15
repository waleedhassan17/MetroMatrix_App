// BottomSheetPicker — choose one value from a list, in a Sheet. Pair it with
// a PickerField that shows the current choice and opens the sheet.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

export interface PickerOption<V extends string> {
  value: V;
  label: string;
  description?: string;
}

export interface BottomSheetPickerProps<V extends string> {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption<V>[];
  value: V | null;
  onSelect: (value: V) => void;
}

const makeStyles = ({ space, size, colors, radius, elevation }: Theme) =>
  StyleSheet.create({
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: size.control.lg,
      gap: space.s12,
      paddingHorizontal: space.s12,
      borderRadius: radius.md,
    },
    optionText: { flex: 1, gap: space.s4 },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: size.control.lg,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      paddingHorizontal: space.s16,
      gap: space.s8,
      ...elevation.input,
    },
    fieldRoot: { gap: space.s8 },
  });

export function BottomSheetPicker<V extends string>({
  visible,
  onClose,
  title,
  options,
  value,
  onSelect,
}: BottomSheetPickerProps<V>) {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View accessibilityRole="radiogroup">
        {options.map(option => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.label}
              style={[styles.option, selected && { backgroundColor: service.accentSoft }]}>
              <View style={styles.optionText}>
                <AppText variant="title" tone={selected ? 'accentDeep' : 'ink'}>
                  {option.label}
                </AppText>
                {option.description ? (
                  <AppText variant="small" tone="muted">
                    {option.description}
                  </AppText>
                ) : null}
              </View>
              {selected ? <Icon name="check" size="md" color={service.accentDeep} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

/** The closed state of a picker: label above, value in a field, chevron. */
export const PickerField: React.FC<{
  label: string;
  valueLabel: string | null;
  placeholder: string;
  onPress: () => void;
  error?: string;
}> = ({ label, valueLabel, placeholder, onPress, error }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.fieldRoot}>
      <AppText variant="label" tone={error ? 'danger' : 'ink'}>
        {label}
      </AppText>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${valueLabel ?? placeholder}`}
        accessibilityHint={error}
        style={[styles.field, error ? { borderColor: colors.danger } : null]}>
        <AppText variant="input" tone={valueLabel ? 'ink' : 'faint'} style={{ flex: 1 }} numberOfLines={1}>
          {valueLabel ?? placeholder}
        </AppText>
        <Icon name="chevron-down" size="md" color={colors.inkMuted} />
      </Pressable>
      {error ? (
        <AppText variant="small" tone="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
};

export default BottomSheetPicker;
