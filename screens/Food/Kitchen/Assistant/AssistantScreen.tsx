// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: the assistant
// ═══════════════════════════════════════════════════════
// Four big actions, each a draft the cook checks before anything is saved:
// write descriptions (English and Urdu), today's specials from what
// expires, combo ideas from what is ordered together, a photo check. Below
// them, what reviews say and the menu's nutrition. The month's actions on
// top; when the assistant is off or used up, it says so and every screen
// keeps its by-hand way.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { useLayoutClass } from '../../../../hooks/useLayoutClass';
import { usageFill, usageLine, usageNote } from '../../../../models/kitchen/aiModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, Card, InlineNotice, ProgressBar, ScreenShell, SkeletonLines } from '../../../../Custom-Components/index';
import { IconWell, ToolSection } from '../../../../Components/admin/AdminParts';
import type { FoodVendorStackParamList } from '../../../../types';
import { loadAssistantAsync, selectAssistant } from './assistantSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenAssistant'>;

const ACTIONS = [
  { key: 'descriptions', to: 'KitchenAiDescriptions', icon: 'create-outline', tint: 'violet', title: 'Write descriptions', body: 'English and Urdu, side by side, for the dishes you pick.' },
  { key: 'specials', to: 'KitchenAiSpecials', icon: 'flame-outline', tint: 'rose', title: 'Today’s specials', body: 'Dishes from what expires soonest, with a price and what you keep.' },
  { key: 'combos', to: 'KitchenAiCombos', icon: 'git-merge-outline', tint: 'amber', title: 'Combo ideas', body: 'Dishes people order together, as a deal at one price.' },
  { key: 'photo', to: 'KitchenAiPhotoCheck', icon: 'camera-outline', tint: 'blue', title: 'Photo check', body: 'Tips to make a dish’s photo sell it better.' },
] as const;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    meterHead: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, minWidth: 0, gap: space.s4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s12 },
    tile: { flexGrow: 1, flexBasis: '45%', minWidth: 0 },
    tileFull: { flexBasis: '100%' },
    action: { gap: space.s8 },
  });

const AssistantScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <AssistantContent {...props} />
  </ServiceScope>
);

const AssistantContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'KitchenTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAssistant);
  const tablet = useLayoutClass() === 'tablet';

  const load = useCallback(() => void dispatch(loadAssistantAsync()), [dispatch]);
  useFocusEffect(load);

  const u = s.usage;
  const note = usageNote(u);
  const go = (to: string) => navigation.navigate(to as never);

  return (
    <ScreenShell title="Assistant" subtitle="Drafts you check before anything is saved" onBack={back} refreshing={s.status === 'loading' && !!u} onRefresh={load}>
      {s.status === 'failed' && !u ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {!u && s.status !== 'failed' ? <SkeletonLines lines={3} /> : null}
      {u ? (
        <Card>
          <View style={styles.gap}>
            <View style={styles.meterHead}>
              <IconWell icon="sparkles-outline" tint="accent" />
              <View style={styles.grow}>
                <AppText variant="title">{usageLine(u)}</AppText>
                <AppText variant="small" tone="muted">
                  {note ?? 'Each draft counts once. Reading a week’s review themes again is free.'}
                </AppText>
              </View>
            </View>
            <ProgressBar progress={1 - usageFill(u)} accessibilityLabel={usageLine(u)} />
          </View>
        </Card>
      ) : null}
      {note ? <InlineNotice tone="info" title={u?.enabled ? 'Assistant actions used up' : 'The assistant is off'} message="Every screen below still works by hand: write a description in the menu, add a dish, set a deal." /> : null}

      <View style={styles.grid}>
        {ACTIONS.map(a => (
          <View key={a.key} style={[styles.tile, !tablet && styles.tileFull]}>
            <Card onPress={() => go(a.to)} accessibilityLabel={`${a.title}. ${a.body}`}>
              <View style={styles.action}>
                <IconWell icon={a.icon} tint={a.tint} />
                <AppText variant="title">{a.title}</AppText>
                <AppText variant="small" tone="muted">
                  {a.body}
                </AppText>
              </View>
            </Card>
          </View>
        ))}
      </View>

      <ToolSection
        title="Also"
        tools={[
          { key: 'reviews', title: 'What reviews say', subtitle: 'This week’s themes, good and bad, with the reviews behind them', icon: 'chatbubbles-outline', tint: 'violet', onPress: () => go('KitchenReviewInsights') },
          { key: 'nutrition', title: 'Nutrition', subtitle: 'Calories and macros per dish, from your recipe cards', icon: 'nutrition-outline', tint: 'blue', onPress: () => go('KitchenNutrition') },
        ]}
      />
    </ScreenShell>
  );
};

export default AssistantScreen;
