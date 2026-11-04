// ═══════════════════════════════════════════════════════
// MetroMatrix — Your week (nutrition)
// ═══════════════════════════════════════════════════════
// The last seven days of what the person ordered on Food Court: estimated
// calories a day against their target, protein, carbs and fat on the days
// they ordered, and what they ordered most. Said plainly, never as praise
// or blame, and clear that food from elsewhere isn't in it.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { SUMMARY_SCOPE, dayLine, targetLine, vsTarget } from '../../models/myKitchen/nutritionModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, BarChart, Button, Card, Divider, EmptyState, InlineNotice, ScreenShell, SectionCard, StatGridSkeleton } from '../../Custom-Components/index';
import { StatGrid } from '../../Components/admin/AdminParts';
import { ShopSection } from '../../Components/shopping/ShopParts';
import type { FoodAppParamList } from '../../models';
import { loadNutritionSummaryAsync, selectNutritionSummary } from './nutritionSummarySlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'NutritionSummary'>;

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekday = (date: string) => DAY_SHORT[new Date(`${date}T12:00:00Z`).getUTCDay()];
const n = (x: number) => x.toLocaleString('en-US');

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    tight: { gap: space.s4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12 },
  });

const NutritionSummary: React.FC<Props> = props => (
  <ServiceScope service="food">
    <NutritionSummaryContent {...props} />
  </ServiceScope>
);

const NutritionSummaryContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'NutritionSettings' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectNutritionSummary);
  const sum = s.summary;

  const load = useCallback(() => void dispatch(loadNutritionSummaryAsync()), [dispatch]);
  useFocusEffect(load);

  if (s.status === 'failed' && s.error.code === 'NUTRITION_OFF') {
    return (
      <ScreenShell title="Your week" onBack={back}>
        <InlineNotice tone="info" title="Nutrition is off" message="Turn it on to see the week of what you ordered." action={{ label: 'Nutrition settings', onPress: () => navigation.navigate('NutritionSettings') }} />
      </ScreenShell>
    );
  }

  const ordered = sum?.days.filter(d => d.orders > 0) ?? [];
  return (
    <ScreenShell title="Your week" subtitle="Food Court orders, the last 7 days" onBack={back} refreshing={s.status === 'loading' && !!sum} onRefresh={load}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {!sum && s.status !== 'failed' ? <StatGridSkeleton count={4} /> : null}
      {sum ? (
        <>
          <SectionCard title="Calories a day (estimated)" icon="bar-chart-outline">
            <View style={styles.gap}>
              <BarChart data={sum.days.map(d => ({ label: weekday(d.date), value: d.kcal }))} format={x => n(x)} />
              <AppText variant="small" tone="muted">
                {targetLine(sum.targetKcal)}
              </AppText>
            </View>
          </SectionCard>

          {ordered.length ? (
            <View style={styles.gap}>
              <ShopSection title="On the days you ordered" subtitle="A day’s average, estimated" inset={false} />
              <StatGrid
                stats={[
                  { key: 'kcal', icon: 'flame-outline', tint: 'amber', value: `${n(sum.averageOnOrderDays.kcal)}`, label: 'kcal' },
                  { key: 'protein', icon: 'barbell-outline', tint: 'blue', value: `${sum.averageOnOrderDays.protein} g`, label: 'Protein' },
                  { key: 'carbs', icon: 'leaf-outline', tint: 'green', value: `${sum.averageOnOrderDays.carbs} g`, label: 'Carbs' },
                  { key: 'fat', icon: 'water-outline', tint: 'violet', value: `${sum.averageOnOrderDays.fat} g`, label: 'Fat' },
                ]}
              />
              {vsTarget(sum.averageOnOrderDays.kcal, sum.targetKcal) ? (
                <AppText variant="small" tone="muted">
                  {vsTarget(sum.averageOnOrderDays.kcal, sum.targetKcal)}
                </AppText>
              ) : null}
            </View>
          ) : (
            <EmptyState ion="restaurant-outline" title="No orders this week" body="No Food Court orders delivered or collected in the last 7 days." />
          )}

          <Card>
            <View style={styles.tight}>
              {sum.days.map((d, i) => (
                <View key={d.date}>
                  {i ? <Divider /> : null}
                  <AppText variant="small" tone={d.orders ? undefined : 'muted'}>
                    {dayLine(d)}
                  </AppText>
                </View>
              ))}
            </View>
          </Card>

          {sum.topDishes.length ? (
            <SectionCard title="You ordered most" icon="trophy-outline">
              <View style={styles.gap}>
                {sum.topDishes.map(t => (
                  <View key={t.name} style={styles.row}>
                    <AppText variant="body">{t.name}</AppText>
                    <AppText variant="bodyStrong">{`× ${t.count}`}</AppText>
                  </View>
                ))}
              </View>
            </SectionCard>
          ) : null}

          <AppText variant="caption" tone="muted">
            {`${SUMMARY_SCOPE}${sum.uncounted ? ` ${sum.uncounted} ${sum.uncounted === 1 ? 'dish has' : 'dishes have'} no numbers, so ${sum.uncounted === 1 ? 'it isn’t' : 'they aren’t'} counted.` : ''}`}
          </AppText>
          <Button label="Nutrition settings" variant="ghost" onPress={() => navigation.navigate('NutritionSettings')} fullWidth />
        </>
      ) : null}
    </ScreenShell>
  );
};

export default NutritionSummary;
