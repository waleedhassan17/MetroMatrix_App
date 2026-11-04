// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen assistant: one theme of the reviews
// ═══════════════════════════════════════════════════════
// What the week's reviews said about it ("cold food"): how many, and the
// anonymised lines the theme came from. Themes are read from reviews with
// names and numbers taken out, so they never point back to one review; the
// reviews page is where the kitchen replies.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { weekLabel } from '../../models/kitchen/assistantModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Card, EmptyState, ScreenShell, StatusPill, TextAction } from '../../Custom-Components/index';
import type { FoodVendorStackParamList } from '../../models';
import { selectReviewInsights } from '../review-insights-screen/reviewInsightsSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenReviewTheme'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s8 },
  });

const ReviewTheme: React.FC<Props> = props => (
  <ServiceScope service="food">
    <ReviewThemeContent {...props} />
  </ServiceScope>
);

const ReviewThemeContent: React.FC<Props> = ({ navigation, route }) => {
  const { theme, label, week } = route.params;
  const { back } = useBack({ name: 'KitchenReviewInsights' });
  const styles = useStyles(makeStyles);
  const t = useAppSelector(selectReviewInsights).data?.themes.find(x => x.key === theme) ?? null;

  return (
    <ScreenShell title={label ?? t?.label ?? 'Reviews'} subtitle={week ? weekLabel(week) : undefined} onBack={back}>
      {t ? (
        <Card>
          <View style={styles.gap}>
            <StatusPill label={`${t.count} ${t.count === 1 ? 'review' : 'reviews'} · ${t.tone === 'negative' ? 'to fix' : 'liked'}`} tone={t.tone === 'negative' ? 'warning' : 'success'} />
            {t.snippets.length ? (
              t.snippets.map(x => (
                <AppText key={x} variant="body">
                  {`“${x}”`}
                </AppText>
              ))
            ) : (
              <AppText variant="small" tone="muted">
                No lines to show for this theme.
              </AppText>
            )}
            <AppText variant="caption" tone="muted">
              Names and numbers are taken out of the reviews first.
            </AppText>
          </View>
        </Card>
      ) : (
        <EmptyState ion="chatbox-ellipses-outline" title="This theme has moved on" body="Open the week’s themes again to see the latest." />
      )}
      <TextAction label="Reply on your reviews page" icon="chatbubble-outline" onPress={() => navigation.navigate('VendorReviews')} />
    </ScreenShell>
  );
};

export default ReviewTheme;
