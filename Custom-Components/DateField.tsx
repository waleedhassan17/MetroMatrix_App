// ═══════════════════════════════════════════════════════
// MetroMatrix — DateField (a calendar day from the phone's own picker)
// ═══════════════════════════════════════════════════════
// Ported from the FYP's components/ui/DateField. The value is always a local
// `YYYY-MM-DD` (never parsed as UTC, which put devices west of Greenwich on
// the previous day). Android opens the system dialog; iOS shows the inline
// calendar in a sheet with Done. Web resolves DateField.web.tsx.

import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useStyles, useTheme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { IonIcon } from './Icon';
import { Sheet } from './Sheet';
import { dateFromKey, dateKeyOf, formatDateKey, makeDateFieldStyles, type DateFieldProps } from './dateFieldShared';

export * from './dateFieldShared';

export const DateField: React.FC<DateFieldProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  placeholder = 'Choose a date',
  error,
  disabled,
}) => {
  const styles = useStyles(makeDateFieldStyles);
  const { colors, opacity } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const minimumDate = dateFromKey(min);
  const maximumDate = dateFromKey(max);
  const initial = () => dateFromKey(value) ?? maximumDate ?? new Date();
  const [draft, setDraft] = useState<Date>(initial);
  const shown = value ? formatDateKey(value) : '';

  const open = () => {
    if (disabled) return;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial(),
        mode: 'date',
        minimumDate,
        maximumDate,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(dateKeyOf(date));
        },
      });
      return;
    }
    setDraft(initial());
    setSheetOpen(true);
  };

  return (
    <View style={styles.root}>
      <AppText variant="label" tone={error ? 'danger' : 'ink'}>
        {label}
      </AppText>
      <Pressable
        onPress={open}
        disabled={disabled}
        style={[styles.field, { borderColor: error ? colors.danger : colors.line }, disabled && { opacity: opacity.disabled }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown || 'not set'}`}
        accessibilityHint="Opens the date picker">
        <IonIcon name="calendar-outline" size="md" color={colors.inkFaint} />
        <AppText variant="input" tone={shown ? 'ink' : 'faint'} style={styles.value} numberOfLines={1}>
          {shown || placeholder}
        </AppText>
        <IonIcon name="chevron-down" size="sm" color={colors.inkFaint} />
      </Pressable>
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}

      {Platform.OS === 'ios' ? (
        <Sheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={label}
          footer={
            <Button
              label="Done"
              fullWidth
              onPress={() => {
                onChange(dateKeyOf(draft));
                setSheetOpen(false);
              }}
            />
          }>
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            themeVariant="light"
            accentColor={colors.brand}
            onChange={(_event, date) => date && setDraft(date)}
          />
        </Sheet>
      ) : null}
    </View>
  );
};

export default DateField;
