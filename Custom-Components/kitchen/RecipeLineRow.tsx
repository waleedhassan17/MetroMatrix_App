// RecipeLineRow — one line of a recipe card: the ingredient (tap to pick
// another) on its own line, then how much, in which unit, and what it costs
// a serving. A tag says when the line is packaging or an add-on's.

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
  /** After the cost: "a serving" on a recipe card; "" where the cost stands alone (waste). */
  costSuffix?: string;
  /** The unit can't change (a cooked dish counts in servings). */
  unitFixed?: boolean;
  /** "Change the ingredient", or "Change the dish". */
  nameHint?: string;
}

const makeStyles = ({ space, size, radius, colors, type }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s8, paddingVertical: space.s12 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    name: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s4, minHeight: size.touch },
    nameText: { flexShrink: 1 },
    controls: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
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
    cost: { flex: 1, textAlign: 'right' },
  });

export const RecipeLineRow: React.FC<RecipeLineRowProps> = ({
  name,
  amount,
  unitLabel,
  costLabel,
  onAmountChange,
  onUnitPress,
  onNamePress,
  onRemove,
  tag,
  error,
  costSuffix = 'a serving',
  unitFixed,
  nameHint = 'Change the ingredient',
}) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Pressable onPress={onNamePress} style={styles.name} accessibilityRole="button" accessibilityLabel={`${name}. ${nameHint}`}>
          <AppText variant="bodyStrong" numberOfLines={2} style={styles.nameText}>
            {name}
          </AppText>
          <IonIcon name="chevron-down" size="sm" color={colors.inkMuted} />
        </Pressable>
        {tag ? <StatusPill label={tag} /> : null}
        <IconButton icon="close" tone="muted" onPress={onRemove} accessibilityLabel={`Remove ${name}`} />
      </View>
      <View style={styles.controls}>
        <TextInput
          value={amount}
          onChangeText={onAmountChange}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.inkFaint}
          style={[styles.amount, error ? styles.amountError : null]}
          accessibilityLabel={`${name} amount in ${unitLabel}`}
        />
        {unitFixed ? (
          <View style={styles.unit}>
            <AppText variant="label">{unitLabel}</AppText>
          </View>
        ) : (
          <Pressable onPress={onUnitPress} style={styles.unit} accessibilityRole="button" accessibilityLabel={`Unit: ${unitLabel}. Change the unit`}>
            <AppText variant="label">{unitLabel}</AppText>
            <IonIcon name="chevron-down" size="sm" color={colors.inkMuted} />
          </Pressable>
        )}
        <AppText variant="caption" tone={error ? 'danger' : 'muted'} style={styles.cost}>
          {error ?? (costLabel ? `${costLabel}${costSuffix ? ` ${costSuffix}` : ''}` : '')}
        </AppText>
      </View>
    </View>
  );
};

export default RecipeLineRow;
