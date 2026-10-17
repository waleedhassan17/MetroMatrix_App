// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: deals
// ═══════════════════════════════════════════════════════
// The kitchen's deals, newest first: what each gives, when it runs, whether
// it is live and how often it's been used. Customers get one deal per
// order — the best for them; a coded one only when they type its code.
// Deals are the kitchen's own: MetroMatrix funds none and takes nothing.

import React, { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { PROMOTION_STATE, dealLabel, whenLine } from '@models/food/promotionModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Button, Card, EmptyState, InlineNotice, ScreenShell, SkeletonLines, StatusPill } from '@custom/index';
import type { FoodPromotion, FoodVendorStackParamList } from '@/types';
import { loadPromotionsAsync, selectVendorPromotions } from './vendorPromotionsSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorPromotions'>;

const makeStyles = ({ space, gutter }: Theme) =>
  StyleSheet.create({
    list: { paddingHorizontal: gutter, paddingTop: space.s16, paddingBottom: space.s40, gap: space.s12 },
    head: { gap: space.s12, paddingBottom: space.s4 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
  });

const PromotionCard: React.FC<{ p: FoodPromotion; onPress: () => void }> = ({ p, onPress }) => {
  const styles = useStyles(makeStyles);
  const state = PROMOTION_STATE[p.state];
  return (
    <Card onPress={onPress} accessibilityLabel={`${p.title}, ${dealLabel(p)}, ${state.label}`}>
      <View style={styles.row}>
        <View style={styles.grow}>
          <AppText variant="title">{p.title}</AppText>
          <AppText variant="bodyStrong" tone="accentDeep">
            {p.label || dealLabel(p)}
          </AppText>
        </View>
        <StatusPill label={state.label} tone={state.tone} />
      </View>
      <AppText variant="small" tone="muted">
        {[p.code ? `Code ${p.code}` : 'Applies by itself', whenLine(p)].join(' · ')}
      </AppText>
      <AppText variant="caption" tone="muted">
        {[
          p.usedCount ? `Used on ${p.usedCount} ${p.usedCount === 1 ? 'order' : 'orders'}` : 'Not used yet',
          p.usageLimit ? `up to ${p.usageLimit}` : null,
          p.firstOrderOnly ? 'first orders only' : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </AppText>
    </Card>
  );
};

const VendorPromotionsScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <VendorPromotionsContent {...props} />
  </ServiceScope>
);

const VendorPromotionsContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'VendorTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorPromotions);

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadPromotionsAsync());
    }, [dispatch]),
  );

  return (
    <ScreenShell title="Deals" subtitle="You fund each one; MetroMatrix takes nothing" onBack={back} scroll={false} padded={false}>
      <FlatList
        data={s.items}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        refreshing={s.status === 'loading' && s.items.length > 0}
        onRefresh={() => void dispatch(loadPromotionsAsync())}
        ListHeaderComponent={
          <View style={styles.head}>
            <Button label="New deal" leftIcon="add" onPress={() => navigation.navigate('VendorPromotion')} fullWidth />
            <AppText variant="small" tone="muted">
              Customers get one deal per order, the one that saves them most. A deal with a code applies only when they type it.
            </AppText>
          </View>
        }
        renderItem={({ item }) => <PromotionCard p={item} onPress={() => navigation.navigate('VendorPromotion', { id: item.id })} />}
        ListEmptyComponent={
          s.status === 'loading' ? (
            <SkeletonLines lines={6} />
          ) : s.status === 'failed' ? (
            <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadPromotionsAsync()) }} />
          ) : (
            <EmptyState icon="tag" title="No deals yet" body="A deal shows on your card and menu, and brings customers back. Start with free delivery or a share off." />
          )
        }
      />
    </ScreenShell>
  );
};

export default VendorPromotionsScreen;
