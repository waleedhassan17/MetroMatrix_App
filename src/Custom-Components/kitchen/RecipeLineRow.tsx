// RecipeLineRow — one line of a recipe card: the ingredient (tap to pick
// another), how much, in which unit, and what it costs per serving. A tag
// says when the line is packaging or belongs to an add-on.

import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IconButton } from '../IconButton';
import { IonIcon } from '../Icon';
import { StatusPill } from '../StatusPill';

export interface RecipeLineRowProps {
  name: string;
  amount: string;
  unitLabel: string;
  costLabel: string;
  onAmountChange: (text: string) => void;
  onUnitPress: () => void;
  onNamePress: () => void;
  onRemove: () => void;
  /** "Packaging", "Add-on: Raita". */
  tag?: string | null;
  error?: string | null;
}

const makeStyles = ({ space, size, radius, colors, type }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s4, paddingVertical: space.s8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    name: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s4, minHeight: size.touch },
    nameText: { flexShrink: 1 },
    amount: {
      ...type.input,
      color: colors.ink,
      width: size.stockField,
      minHeight: size.control.sm,
      paddingHorizontal: space.s12,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      textAlign: 'right',
    },
    amountError: { borderColor: colors.danger },
    unit: { minHeight: size.control.sm, minWidth: size.control.sm, paddingHorizontal: space.s8, borderRadius: radius.md, backgroundColor: colors.surfaceSunk, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.s4 },
    foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s8 },
  });

export const RecipeLineRow: React.FC<RecipeLineRowProps> = ({ name, amount, unitLabel, costLabel, onAmountChange, onUnitPress, onNamePress, onRemove, tag, error }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Pressable onPress={onNamePress} style={styles.name} accessibilityRole="button" accessibilityLabel={`${name}. Change the ingredient`}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.nameText}>
            {name}
          </AppText>
          <IonIcon name="chevron-down" size="sm" color={colors.inkMuted} />
        </Pressable>
        <TextInput
          value={amount}
          onChangeText={onAmountChange}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.inkFaint}
          style={[styles.amount, error ? styles.amountError : null]}
          accessibilityLabel={`${name} amount in ${unitLabel}`}
        />
        <Pressable onPress={onUnitPress} style={styles.unit} accessibilityRole="button" accessibilityLabel={`Unit: ${unitLabel}. Change the unit`}>
          <AppText variant="label">{unitLabel}</AppText>
          <IonIcon name="chevron-down" size="sm" color={colors.inkMuted} />
        </Pressable>
        <IconButton icon="close" tone="muted" onPress={onRemove} accessibilityLabel={`Remove ${name}`} />
      </View>
      <View style={styles.foot}>
        {tag ? <StatusPill label={tag} /> : <View />}
        <AppText variant="caption" tone={error ? 'danger' : 'muted'}>
          {error ?? `${costLabel} a serving`}
        </AppText>
      </View>
    </View>
  );
};

export default RecipeLineRow;
