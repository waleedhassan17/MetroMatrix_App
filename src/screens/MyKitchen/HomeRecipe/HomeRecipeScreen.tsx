// ═══════════════════════════════════════════════════════
// MetroMatrix — My Kitchen: a recipe
// ═══════════════════════════════════════════════════════
// What it takes (what you have ticked, what's missing marked, what expires
// soon called out) and the steps. "Cook step by step" shows one step at a
// time in large text and keeps the screen awake while you cook. Urdu
// recipes read right to left. Missing things come from Shopping in a tap.

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, Card, Divider, InlineNotice, IonIcon, ScreenShell, SkeletonLines, StatusPill } from '@custom/index';
import type { FoodAppParamList } from '@/types';
import { formatQty } from '@utils/units';
import { selectNutritionSettings } from '../NutritionSettings/nutritionSettingsSlice';
import { loadHomeRecipeAsync, selectHomeRecipe } from './homeRecipeSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'MyKitchenRecipe'>;

const KEEP_AWAKE_TAG = 'mykitchen-recipe';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s8 },
    grow: { flex: 1, minWidth: 0 },
    step: { flexDirection: 'row', gap: space.s12, paddingVertical: space.s8 },
    nav: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1, flexBasis: 0, minWidth: 0 },
    rtl: { writingDirection: 'rtl', textAlign: 'right' },
  });

const HomeRecipeScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <HomeRecipeContent {...props} />
  </ServiceScope>
);

const HomeRecipeContent: React.FC<Props> = ({ navigation, route }) => {
  const { id, language = 'en', servings = null } = route.params;
  const { back } = useBack({ name: 'MyKitchenRecipes' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const s = useAppSelector(selectHomeRecipe);
  const showCalories = useAppSelector(selectNutritionSettings).settings?.showCalories ?? false;
  const [stepAt, setStepAt] = useState<number | null>(null);

  const load = useCallback(() => void dispatch(loadHomeRecipeAsync({ id, language, servings })), [dispatch, id, language, servings]);
  useFocusEffect(load);

  // Step by step: the screen stays awake until it ends.
  useEffect(() => {
    if (stepAt === null) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => void deactivateKeepAwake(KEEP_AWAKE_TAG);
  }, [stepAt]);

  const r = s.recipe?.id === id ? s.recipe : null;
  if (!r) {
    return (
      <ScreenShell title="Recipe" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : <SkeletonLines lines={10} />}
      </ScreenShell>
    );
  }

  const ur = r.language === 'ur';
  const text = ur ? styles.rtl : undefined;
  const missing = r.ingredients.filter(i => !i.have);

  if (stepAt !== null) {
    const last = stepAt >= r.steps.length - 1;
    return (
      <ScreenShell title={r.title} subtitle={`Step ${stepAt + 1} of ${r.steps.length}`} onBack={() => setStepAt(null)}>
        <Card>
          <AppText variant="h1" style={text} accessibilityLanguage={ur ? 'ur' : 'en'}>
            {r.steps[stepAt]}
          </AppText>
        </Card>
        <View style={styles.nav}>
          <View style={styles.half}>
            <Button label="Back a step" variant="secondary" disabled={stepAt === 0} onPress={() => setStepAt(stepAt - 1)} fullWidth />
          </View>
          <View style={styles.half}>
            <Button label={last ? 'Done' : 'Next step'} onPress={() => setStepAt(last ? null : stepAt + 1)} fullWidth />
          </View>
        </View>
        <AppText variant="caption" tone="muted" align="center">
          The screen stays on while you cook.
        </AppText>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={r.title} subtitle={`${r.minutes} min · for ${r.servings}`} onBack={back} refreshing={s.status === 'loading'} onRefresh={load}>
      {showCalories && r.nutrition ? (
        <AppText variant="small" tone="muted">{`About ${r.nutrition.kcal} kcal a serving (estimated)`}</AppText>
      ) : null}
      <Button label="Cook step by step" leftIcon="play-outline" onPress={() => setStepAt(0)} fullWidth />
      <Card>
        <View style={styles.gap}>
          <AppText variant="title">{`What it takes${missing.length ? ` · ${missing.length} missing` : ''}`}</AppText>
          {r.ingredients.map((i, n) => (
            <View key={i.key}>
              {n ? <Divider /> : null}
              <View style={styles.row}>
                <IonIcon name={i.have ? 'checkmark-circle' : 'ellipse-outline'} size="md" color={i.have ? service.accent : colors.inkFaint} />
                <AppText variant="body" style={[styles.grow, text]}>
                  {i.name}
                </AppText>
                {i.usesExpiring ? <StatusPill label="Use soon" tone="warning" /> : null}
                <AppText variant="bodyStrong">{formatQty(i.qty, i.unit, { dozens: i.key === 'egg' })}</AppText>
              </View>
            </View>
          ))}
          {missing.length ? (
            <Button label={`Get the ${missing.length} missing from Shopping`} variant="secondary" leftIcon="bag-add-outline" onPress={() => navigation.navigate('MyKitchenMissing', { id: r.id, title: r.title, servings: r.servings })} fullWidth />
          ) : null}
        </View>
      </Card>
      <Card>
        <View style={styles.gap}>
          <AppText variant="title">Steps</AppText>
          {r.steps.map((st, n) => (
            <View key={st} style={styles.step}>
              <AppText variant="bodyStrong">{`${n + 1}.`}</AppText>
              <AppText variant="body" style={[styles.grow, text]}>
                {st}
              </AppText>
            </View>
          ))}
        </View>
      </Card>
      <Button label="Order it nearby instead" variant="ghost" onPress={() => navigation.navigate('FoodSearch', { q: r.searchTerm })} fullWidth />
    </ScreenShell>
  );
};

export default HomeRecipeScreen;
