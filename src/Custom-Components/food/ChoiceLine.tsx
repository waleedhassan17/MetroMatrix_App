// ChoiceLine — one choice in the dish sheet: a radio (pick one) or a tick box
// (pick several), its name, and its price ("+ Rs 60", or the size's price).
// An out-of-stock choice is shown but can't be picked.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';

export interface ChoiceLineProps {
  label: string;
  /** "+ Rs 60", "Rs 1,100", or null. */
  price: string | null;
  selected: boolean;
  multiple: boolean;
  disabled?: boolean;
  /** "Out of stock". */
  note?: string | null;
  onPress: () => void;
}

const makeStyles = ({ space, size, radius, colors }: Theme) =>
  StyleSheet.create({
    root: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: size.touch, paddingVertical: space.s8 },
    mark: {
      width: size.checkbox,
      height: size.checkbox,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: size.focusBorder,
      borderColor: colors.lineStrong,
    },
    text: { flex: 1, gap: space.s4 },
    round: { borderRadius: radius.pill },
    square: { borderRadius: radius.sm },
  });

export const ChoiceLine: React.FC<ChoiceLineProps> = ({ label, price, selected, multiple, disabled, note, onPress }) => {
  const styles = useStyles(makeStyles);
  const { service, opacity } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.root, disabled && { opacity: opacity.disabled }]}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityLabel={[label, price, note].filter(Boolean).join(', ')}
    >
      <View style={[styles.mark, multiple ? styles.square : styles.round, selected && { borderColor: service.accent, backgroundColor: multiple ? service.accent : undefined }]}>
        {selected ? multiple ? <IonIcon name="checkmark" size="sm" color={service.onAccent} /> : <IonIcon name="ellipse" size="sm" color={service.accent} /> : null}
      </View>
      <View style={styles.text}>
        <AppText variant="body">{label}</AppText>
        {note ? (
          <AppText variant="small" tone="muted">
            {note}
          </AppText>
        ) : null}
      </View>
      {price ? (
        <AppText variant="small" tone="muted">
          {price}
        </AppText>
      ) : null}
    </Pressable>
  );
};

export default ChoiceLine;
