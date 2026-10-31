// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen assistant: what reviews say
// ═══════════════════════════════════════════════════════
// A week of reviews read for themes: what customers liked (taste, hot and
// fresh, portions) and what went wrong (took too long, arrived cold), each
// with how many reviews said it and a few lines without names. A theme opens
// the reviews behind it. Weeks to pick from, with how many reviews each.

import React, { useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { aiDownNote, isAiDown } from '../../../../models/kitchen/aiModel';
import { weekLabel } from '../../../../models/kitchen/assistantModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, Card, ChoiceChip, EmptyState, InlineNotice, IonIcon, ScreenShell, SkeletonLines } from '../../../../Custom-Components/index';
import { SectionHead } from '../../../../Components/admin/AdminParts';
import type { FoodVendorStackParamList, ReviewTheme } from '../../../../types';
import { loadReviewInsightsAsync, selectReviewInsights } from './reviewInsightsSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenReviewInsights'>;

const makeStyles = ({ space, gutter }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    tight: { gap: space.s4 },
    chipBar: { flexGrow: 0, flexShrink: 0 },
    chips: { flexDirection: 'row', gap: space.s8, paddingRight: gutter },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    grow: { flex: 1, minWidth: 0 },
    group: { gap: space.s8 },
  });

const ReviewInsightsScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <ReviewInsightsContent {...props} />
  </ServiceScope>
);

const ReviewInsightsContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'KitchenAssistant' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const s = useAppSelector(selectReviewInsights);
  const d = s.data;

  // The week on screen, kept across focus (a theme's reviews and back).
  const shown = useRef<string | null>(null);
  const load = useCallback(
    (week: string | null = shown.current) => {
      shown.current = week;
      void dispatch(loadReviewInsightsAsync(week));
    },
    [dispatch],
  );
  useFocusEffect(useCallback(() => load(), [load]));

  const down = isAiDown(s.error.code) ? aiDownNote(s.error.code, s.error.details) : null;
  const theme = (t: ReviewTheme) => (
    <Card
      key={t.key}
      onPress={() => navigation.navigate('KitchenReviewTheme', { theme: t.key, label: t.label, week: d!.week })}
      accessibilityLabel={`${t.label}: ${t.count} ${t.count === 1 ? 'review' : 'reviews'}. Opens them.`}>
      <View style={styles.gap}>
        <View style={styles.head}>
          <IonIcon name={t.tone === 'positive' ? 'thumbs-up-outline' : 'alert-circle-outline'} size="md" color={t.tone === 'positive' ? colors.success : colors.warning} />
          <AppText variant="title" style={styles.grow}>
            {t.label}
          </AppText>
          <AppText variant="bodyStrong">{`${t.count} ${t.count === 1 ? 'review' : 'reviews'}`}</AppText>
        </View>
        {t.snippets.map(x => (
          <AppText key={x} variant="small" tone="muted">
            {`“${x}”`}
          </AppText>
        ))}
        <AppText variant="small" tone="accentDeep">
          See the reviews
        </AppText>
      </View>
    </Card>
  );

  const good = d?.themes.filter(t => t.tone === 'positive') ?? [];
  const bad = d?.themes.filter(t => t.tone === 'negative') ?? [];
  return (
    <ScreenShell title="What reviews say" subtitle={d ? `${weekLabel(d.week)} · ${d.reviewCount} ${d.reviewCount === 1 ? 'review' : 'reviews'}` : 'This week’s themes'} onBack={back} refreshing={s.status === 'loading' && !!d} onRefresh={() => load(d?.week ?? null)}>
      {down ? <InlineNotice tone="info" title={down.title} message="You can still read every review and reply to it." action={{ label: 'Open your reviews', onPress: () => navigation.navigate('VendorReviews') }} /> : null}
      {s.error.message && !down ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => load(d?.week ?? null) }} /> : null}
      {!d && s.status !== 'failed' ? <SkeletonLines lines={8} /> : null}
      {d ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
            {d.weeks.map(w => (
              <ChoiceChip key={w.week} label={`${weekLabel(w.week)} · ${w.count}`} selected={w.week === d.week} onPress={() => load(w.week)} />
            ))}
          </ScrollView>
          {!d.themes.length ? <EmptyState icon="message-square" title="Nothing to read yet" body="No reviews that week. Pick another week above." /> : null}
          {bad.length ? (
            <View style={styles.group}>
              <SectionHead title="To look at" />
              {bad.map(theme)}
            </View>
          ) : null}
          {good.length ? (
            <View style={styles.group}>
              <SectionHead title="What they liked" />
              {good.map(theme)}
            </View>
          ) : null}
          <AppText variant="caption" tone="muted">
            Read by the assistant from the week’s reviews. Lines are shown without names or numbers. A week counts once, however often you look.
          </AppText>
        </>
      ) : null}
    </ScreenShell>
  );
};

export default ReviewInsightsScreen;
