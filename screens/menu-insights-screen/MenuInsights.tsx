// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen growth: menu insights
// ═══════════════════════════════════════════════════════
// Every dish of the last 30 days on two axes: how often it is ordered and
// what the kitchen keeps on each. Four plain-word groups ("Sells and
// earns", "Sells, earns little" …), never menu-engineering jargon. A dish
// opens to its numbers and one suggestion, and from there a test: a new
// price (dishes without sizes) or a new photo, for 3 to 14 days. Tests that
// are running or have a result sit on top.

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { EXPERIMENT_DAY_CHOICES, canTestPrice, changeLine, priceBounds, progressLine, validateTestPrice } from '../../models/kitchen/reachModel';
import { EXPERIMENT_STATUS, QUADRANT, QUADRANT_ORDER } from '../../models/kitchen/kitchenStatusModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, ChoiceChip, InlineNotice, ListRow, QuadrantChart, ScreenShell, Sheet, SkeletonLines, StatusPill, TextField } from '../../Custom-Components/index';
import { RowCard, SectionHead, ToolSection } from '../../Components/admin/AdminParts';
import type { FoodVendorStackParamList, LocalFile, MenuInsightItem } from '../../models';
import { pickImageFromLibrary } from '../../utils/pickers/pickers';
import { formatPKR } from '../../utils/money/money';
import { haptics } from '../../utils/haptics/haptics';
import { clearStartError, loadMenuInsightsAsync, selectMenuInsights, startExperimentAsync } from './menuInsightsSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'GrowthMenuInsights'>;
type Test = { kind: 'price'; price: string; days: number } | { kind: 'photo'; file: LocalFile | null; days: number };

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    tight: { gap: space.s4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.s12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    group: { gap: space.s8 },
  });

const keepLine = (i: MenuInsightItem) => (i.keep === null ? 'no recipe card yet' : `you keep ${formatPKR(i.keep)} each${i.keepPct !== null ? ` (${i.keepPct}%)` : ''}`);

const MenuInsights: React.FC<Props> = props => (
  <ServiceScope service="food">
    <MenuInsightsContent {...props} />
  </ServiceScope>
);

const MenuInsightsContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'KitchenTab' } });
  const dispatch = useAppDispatch();
  const appStore = useAppStore();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectMenuInsights);
  const [openId, setOpenId] = useState<string | null>(route.params?.itemId ?? null);
  const [test, setTest] = useState<Test | null>(null);

  const load = useCallback(() => void dispatch(loadMenuInsightsAsync()), [dispatch]);
  useFocusEffect(load);

  const items = useMemo(() => s.data?.items ?? [], [s.data]);
  const open = items.find(i => i.itemId === openId) ?? null;
  const live = s.experiments.filter(e => e.status === 'running' || e.status === 'done');
  const runningFor = (itemId: string) => s.experiments.find(e => e.itemId === itemId && (e.status === 'running' || e.status === 'done')) ?? null;

  const close = () => {
    setOpenId(null);
    setTest(null);
    dispatch(clearStartError());
  };

  const start = async () => {
    if (!open || !test) return;
    haptics.press();
    const res = await dispatch(
      startExperimentAsync(
        test.kind === 'price'
          ? { itemId: open.itemId, days: test.days, change: { kind: 'price', price: Number(test.price) } }
          : { itemId: open.itemId, days: test.days, change: { kind: 'photo', file: test.file! } },
      ),
    );
    const started = startExperimentAsync.fulfilled.match(res) ? selectMenuInsights(appStore.getState()).started : null;
    if (started) {
      haptics.success();
      close();
      Toast.show({ type: 'success', text1: `Testing ${started.itemName}`, text2: `For ${started.days} days. The result shows here when it ends.` });
    } else haptics.warning();
  };

  const priceError = test?.kind === 'price' && open ? validateTestPrice(test.price, open.price) : null;

  return (
    <ScreenShell title="Menu insights" subtitle="Your dishes, the last 30 days" onBack={back} refreshing={s.status === 'loading' && !!s.data} onRefresh={load}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {!s.data && s.status !== 'failed' ? <SkeletonLines lines={10} /> : null}

      {live.length ? (
        <View style={styles.group}>
          <SectionHead title="Your tests" />
          {live.map(e => (
            <RowCard
              key={e.id}
              title={e.itemName}
              lines={[changeLine(e), progressLine(e)]}
              mark={{ icon: 'flask-outline', tint: 'violet' }}
              pill={{ label: EXPERIMENT_STATUS[e.status].label, tone: EXPERIMENT_STATUS[e.status].tone }}
              onPress={() => navigation.navigate('GrowthExperiment', { id: e.id })}
            />
          ))}
        </View>
      ) : null}

      {s.data ? (
        <>
          <Card>
            <View style={styles.gap}>
              <AppText variant="title">Ordered against earned</AppText>
              <QuadrantChart
                points={items.filter(i => i.quadrant !== 'unknown').map(i => ({ id: i.itemId, label: i.name, popularity: i.popularity, profit: i.profit ?? 0, quadrant: i.quadrant as Exclude<typeof i.quadrant, 'unknown'> }))}
                onPress={setOpenId}
              />
              <AppText variant="small" tone="muted">
                Tap a dot to see the dish. Further right is ordered more; higher up is more kept on each.
              </AppText>
            </View>
          </Card>

          <ToolSection
            title="Also"
            tools={[
              { key: 'combos', title: 'Combo ideas', subtitle: 'Dishes ordered together, as one deal', icon: 'git-merge-outline', tint: 'amber', onPress: () => navigation.navigate('KitchenAiCombos') },
              { key: 'reviews', title: 'What reviews say', subtitle: 'The week’s themes, good and bad', icon: 'chatbubbles-outline', tint: 'rose', onPress: () => navigation.navigate('KitchenReviewInsights') },
            ]}
          />
          {QUADRANT_ORDER.map(q => {
            const group = items.filter(i => i.quadrant === q);
            if (!group.length) return null;
            return (
              <View key={q} style={styles.group}>
                <SectionHead title={`${QUADRANT[q].label} · ${group.length}`} />
                <Card>
                  {group.map(i => (
                    <ListRow key={i.itemId} title={i.name} subtitle={`${i.sold} sold · ${keepLine(i)}`} value={i.experimentRunning ? 'Testing' : undefined} onPress={() => setOpenId(i.itemId)} chevron />
                  ))}
                </Card>
              </View>
            );
          })}
        </>
      ) : null}

      <Sheet
        visible={!!open}
        onClose={close}
        title={open?.name ?? ''}
        subtitle={open ? QUADRANT[open.quadrant].label : undefined}
        footer={
          open && test ? (
            <Button
              label="Start the test"
              loading={s.starting}
              disabled={test.kind === 'price' ? !!priceError : !test.file}
              onPress={() => void start()}
              fullWidth
            />
          ) : undefined
        }>
        {open ? (
          <View style={styles.gap}>
            <AppText variant="small" tone="muted">
              {QUADRANT[open.quadrant].hint}
            </AppText>
            <View style={styles.tight}>
              <View style={styles.row}>
                <AppText variant="body">Sold in 30 days</AppText>
                <AppText variant="bodyStrong">{String(open.sold)}</AppText>
              </View>
              <View style={styles.row}>
                <AppText variant="body">Price</AppText>
                <AppText variant="bodyStrong">{open.hasSizes ? `from ${formatPKR(open.price)}` : formatPKR(open.price)}</AppText>
              </View>
              <View style={styles.row}>
                <AppText variant="body">You keep on each</AppText>
                <AppText variant="bodyStrong">{open.keep === null ? 'Add a recipe card' : `${formatPKR(open.keep)}${open.keepPct !== null ? ` · ${open.keepPct}%` : ''}`}</AppText>
              </View>
            </View>
            <Card>
              <View style={styles.tight}>
                <AppText variant="overline" tone="muted">
                  Suggestion
                </AppText>
                <AppText variant="body">{open.suggestion.text}</AppText>
              </View>
            </Card>
            {s.startError.message ? <InlineNotice message={s.startError.message} /> : null}

            {test ? (
              <View style={styles.gap}>
                {test.kind === 'price' ? (
                  <TextField
                    label="New price for the test"
                    mode="numeric"
                    value={test.price}
                    onChangeText={v => setTest({ ...test, price: v })}
                    helper={`Today ${formatPKR(open.price)} · between ${formatPKR(priceBounds(open.price).min)} and ${formatPKR(priceBounds(open.price).max)}`}
                    error={test.price && priceError ? priceError : undefined}
                  />
                ) : (
                  <Button
                    label={test.file ? 'Photo picked · pick another' : 'Pick the new photo'}
                    variant="secondary"
                    leftIcon="image-outline"
                    onPress={async () => {
                      const f = await pickImageFromLibrary();
                      if (f) setTest({ ...test, file: f });
                    }}
                    fullWidth
                  />
                )}
                <AppText variant="label">How long</AppText>
                <View style={styles.chips}>
                  {EXPERIMENT_DAY_CHOICES.map(d => (
                    <ChoiceChip key={d} label={`${d} days`} selected={test.days === d} onPress={() => setTest({ ...test, days: d })} />
                  ))}
                </View>
                <AppText variant="small" tone="muted">
                  {test.kind === 'price'
                    ? 'Your menu shows the new price straight away. At the end you see orders and recorded sales before and during, then keep it, adjust it or go back.'
                    : 'Your menu shows the new photo straight away. At the end you see orders before and during, then keep it or go back.'}
                </AppText>
              </View>
            ) : runningFor(open.itemId) ? (
              <Button label="See the test" variant="secondary" onPress={() => navigation.navigate('GrowthExperiment', { id: runningFor(open.itemId)!.id })} fullWidth />
            ) : (
              <View style={styles.gap}>
                {open.suggestion.kind === 'recipe' ? (
                  <Button label="Add its recipe card" onPress={() => (close(), navigation.navigate('KitchenRecipe', { itemId: open.itemId }))} fullWidth />
                ) : null}
                {canTestPrice(open) ? (
                  <Button
                    label={open.suggestion.kind === 'price' && open.suggestion.price ? `Test ${formatPKR(open.suggestion.price)}` : 'Test a new price'}
                    variant={open.suggestion.kind === 'price' ? 'primary' : 'secondary'}
                    onPress={() => setTest({ kind: 'price', price: String(open.suggestion.price ?? ''), days: 7 })}
                    fullWidth
                  />
                ) : null}
                <Button label="Test a new photo" variant={open.suggestion.kind === 'photo' ? 'primary' : 'secondary'} onPress={() => setTest({ kind: 'photo', file: null, days: 7 })} fullWidth />
                {open.suggestion.kind === 'drop' ? (
                  <Button label="Open it in your menu" variant="ghost" onPress={() => (close(), navigation.navigate('VendorMenuItem', { id: open.itemId }))} fullWidth />
                ) : null}
                {open.hasSizes ? (
                  <AppText variant="small" tone="muted">
                    Price tests are for dishes without sizes. A photo test works for any dish.
                  </AppText>
                ) : null}
              </View>
            )}
            {open.experimentRunning && !runningFor(open.itemId) ? <StatusPill label="Testing" tone="accent" /> : null}
          </View>
        ) : null}
      </Sheet>
    </ScreenShell>
  );
};

export default MenuInsights;
