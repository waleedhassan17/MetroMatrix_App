// NutritionBlock — a dish's estimated calories and macros, always labelled
// "estimated", with how it was worked out (from the kitchen's recipe, or the
// assistant's estimate). Shown only to people who turned calories on.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import { AppText } from '../AppText';

export interface NutritionFacts {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  method: 'recipe' | 'ai_estimate';
  /** People the dish as sold is for. */
  serves?: number;
}

const METHOD: Record<NutritionFacts['method'], string> = {
  recipe: 'Estimated from the kitchen’s recipe, not measured',
  ai_estimate: 'Estimated by the assistant from the dish, not measured',
};

const grouped = (x: number) => x.toLocaleString('en-US');

const makeStyles = ({ space, radius, colors }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s8, padding: space.s12, borderRadius: radius.lg, backgroundColor: colors.surfaceSunk },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s8 },
    cell: { alignItems: 'center', gap: space.s4, flex: 1 },
  });

export const NutritionBlock: React.FC<{ facts: NutritionFacts }> = ({ facts }) => {
  const styles = useStyles(makeStyles);
  const cell = (value: string, label: string) => (
    <View style={styles.cell}>
      <AppText variant="title">{value}</AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
  const whole = facts.serves && facts.serves > 1 ? `The whole dish, for ${facts.serves}. ` : '';
  return (
    <View
      style={styles.root}
      accessible
      accessibilityLabel={`About ${facts.kcal} calories, ${facts.protein} grams protein, ${facts.carbs} grams carbs, ${facts.fat} grams fat. ${whole}${METHOD[facts.method]}.`}>
      <View style={styles.row}>
        {cell(grouped(facts.kcal), 'kcal')}
        {cell(`${facts.protein} g`, 'protein')}
        {cell(`${facts.carbs} g`, 'carbs')}
        {cell(`${facts.fat} g`, 'fat')}
      </View>
      <AppText variant="caption" tone="muted" align="center">
        {`${whole}${METHOD[facts.method]}.`}
      </AppText>
    </View>
  );
};

export default NutritionBlock;
