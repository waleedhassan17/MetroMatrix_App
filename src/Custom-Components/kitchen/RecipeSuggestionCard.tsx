// RecipeSuggestionCard — something to cook from the pantry: its name, time
// and servings, what the customer has and what is missing, an estimate of
// its nutrition (if they turned it on), and three ways forward.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { Card } from '../Card';
import { IonIcon } from '../Icon';
import { TextAction } from '../TextAction';
import { ContentText } from './kitchenShared';

export interface RecipeSuggestionData {
  title: string;
  minutes: number;
  servings: number;
  have: string[];
  missing: string[];
  /** "About 520 kcal a serving (estimated)". */
  nutritionLabel?: string | null;
  /** Uses things that expire soon. */
  usesExpiring?: boolean;
}

const makeStyles = ({ space, radius, colors, size }: Theme) =>
  StyleSheet.create({
    body: { gap: space.s12 },
    meta: { flexDirection: 'row', gap: space.s16, flexWrap: 'wrap' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    have: { paddingHorizontal: space.s8, paddingVertical: space.s4, borderRadius: radius.pill, backgroundColor: colors.successSoft },
    missing: { paddingHorizontal: space.s8, paddingVertical: space.s4, borderRadius: radius.pill, borderWidth: size.border, borderColor: colors.line },
    actions: { flexDirection: 'row', gap: space.s8, flexWrap: 'wrap', alignItems: 'center' },
  });

export const RecipeSuggestionCard: React.FC<{ recipe: RecipeSuggestionData; onCook: () => void; onGetMissing?: () => void; onOrderNearby: () => void }> = ({ recipe, onCook, onGetMissing, onOrderNearby }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Card>
      <View style={styles.body}>
        <ContentText variant="cardTitle">{recipe.title}</ContentText>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <IonIcon name="time-outline" size="sm" color={colors.inkMuted} />
            <AppText variant="small" tone="muted">
              {recipe.minutes} min
            </AppText>
          </View>
          <View style={styles.metaItem}>
            <IonIcon name="people-outline" size="sm" color={colors.inkMuted} />
            <AppText variant="small" tone="muted">
              Serves {recipe.servings}
            </AppText>
          </View>
          {recipe.usesExpiring ? (
            <View style={styles.metaItem}>
              <IonIcon name="leaf-outline" size="sm" color={colors.success} />
              <AppText variant="small" tone="success">
                Uses what expires soon
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.chips} accessible accessibilityLabel={`You have ${recipe.have.join(', ') || 'none of it'}. Missing ${recipe.missing.join(', ') || 'nothing'}.`}>
          {recipe.have.map(h => (
            <View key={`h-${h}`} style={styles.have}>
              <AppText variant="chip" tone="success">
                {h}
              </AppText>
            </View>
          ))}
          {recipe.missing.map(m => (
            <View key={`m-${m}`} style={styles.missing}>
              <AppText variant="chip" tone="muted">
                Need: {m}
              </AppText>
            </View>
          ))}
        </View>
        {recipe.nutritionLabel ? (
          <AppText variant="caption" tone="muted">
            {recipe.nutritionLabel}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          <Button label="Cook this" onPress={onCook} size="sm" />
          {recipe.missing.length && onGetMissing ? <Button label="Get missing items" variant="secondary" onPress={onGetMissing} size="sm" /> : null}
          <TextAction label="Order it nearby" onPress={onOrderNearby} />
        </View>
      </View>
    </Card>
  );
};

export default RecipeSuggestionCard;
