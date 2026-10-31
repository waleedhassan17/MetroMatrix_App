// ═══════════════════════════════════════════════════════
// MetroMatrix — My Kitchen: what to cook
// ═══════════════════════════════════════════════════════
// Recipe ideas from what's in the kitchen, those using what expires first
// on top, with what's missing marked. English or Urdu, a time and how many
// it's for. Each opens its recipe, gets its missing items from Shopping, or
// finds it on Food Court nearby. Each set of ideas is one assistant action.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { aiDownNote, isAiDown } from '../../models/kitchen/aiModel';
import { RECIPE_TIMES, SERVINGS } from '../../models/myKitchen/pantryModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, ChoiceChip, EmptyState, InlineNotice, RecipeSuggestionCard, ScreenShell, SkeletonLines } from '../../Custom-Components/index';
import type { FoodAppParamList } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { selectRecipeIdeas, setRecipeFilter, suggestRecipesAsync } from './recipeIdeasSlice';
import { selectShowCalories } from '../nutrition-settings-screen/nutritionSettingsSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'MyKitchenRecipes'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const RecipeIdeas: React.FC<Props> = props => (
  <ServiceScope service="food">
    <RecipeIdeasContent {...props} />
  </ServiceScope>
);

const RecipeIdeasContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'MyKitchen' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectRecipeIdeas);
  // Calories show only for people who turned them on.
  const showCalories = useAppSelector(selectShowCalories);
  const down = isAiDown(s.error.code) ? aiDownNote(s.error.code, s.error.details) : null;

  const suggest = async () => {
    haptics.press();
    const r = await dispatch(suggestRecipesAsync({ language: s.language, maxMinutes: s.maxMinutes, servings: s.servings }));
    if (suggestRecipesAsync.fulfilled.match(r)) haptics.success();
  };

  return (
    <ScreenShell title="What to cook" subtitle="From what’s in your kitchen" onBack={back}>
      <Card>
        <View style={styles.gap}>
          <AppText variant="label">Recipe in</AppText>
          <View style={styles.chips}>
            <ChoiceChip label="English" selected={s.language === 'en'} onPress={() => dispatch(setRecipeFilter({ language: 'en' }))} />
            <ChoiceChip label="Urdu" selected={s.language === 'ur'} onPress={() => dispatch(setRecipeFilter({ language: 'ur' }))} />
          </View>
          <AppText variant="label">Time</AppText>
          <View style={styles.chips}>
            {RECIPE_TIMES.map(t => (
              <ChoiceChip key={t.label} label={t.label} selected={s.maxMinutes === t.minutes} onPress={() => dispatch(setRecipeFilter({ maxMinutes: t.minutes }))} />
            ))}
          </View>
          <AppText variant="label">For</AppText>
          <View style={styles.chips}>
            {SERVINGS.map(n => (
              <ChoiceChip key={n} label={`${n} people`} selected={s.servings === n} onPress={() => dispatch(setRecipeFilter({ servings: n }))} />
            ))}
          </View>
          <Button label={s.ideas.length ? 'Suggest again' : 'Suggest recipes'} loading={s.status === 'loading'} onPress={() => void suggest()} fullWidth />
          <AppText variant="caption" tone="muted">
            One assistant action each time. Things that expire soonest come first.
          </AppText>
        </View>
      </Card>
      {down ? <InlineNotice tone="info" title={down.title} message="You can still keep your kitchen list, and order on Food Court." /> : null}
      {s.error.message && !down ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void suggest() }} /> : null}
      {s.status === 'loading' && !s.ideas.length ? <SkeletonLines lines={8} /> : null}
      {s.status === 'succeeded' && !s.ideas.length ? <EmptyState icon="book-open" title="Nothing fits yet" body="Add a few things to your kitchen, or pick more time." /> : null}
      {s.ideas.map(r => (
        <RecipeSuggestionCard
          key={r.id}
          recipe={{
            title: r.title,
            minutes: r.minutes,
            servings: r.servings,
            have: r.have,
            missing: r.missing,
            usesExpiring: r.usesExpiring.length > 0,
            nutritionLabel: showCalories && r.nutrition ? `About ${r.nutrition.kcal} kcal a serving (estimated)` : null,
          }}
          onCook={() => navigation.navigate('MyKitchenRecipe', { id: r.id, language: s.language, servings: s.servings })}
          onGetMissing={r.missing.length ? () => navigation.navigate('MyKitchenMissing', { id: r.id, title: r.title, servings: s.servings }) : undefined}
          onOrderNearby={() => navigation.navigate('FoodSearch', { q: r.searchTerm })}
        />
      ))}
    </ScreenShell>
  );
};

export default RecipeIdeas;
