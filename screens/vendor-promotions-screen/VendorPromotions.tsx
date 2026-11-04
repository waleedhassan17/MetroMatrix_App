// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: deals
// ═══════════════════════════════════════════════════════
// The kitchen's deals, newest first: what each gives, when it runs, whether
// it is live and how often it's been used. Customers get one deal per
// order — the best for them; a coded one only when they type its code.
// Deals are the kitchen's own: MetroMatrix funds none and takes nothing.

import React, { useCallback } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { PROMOTION_STATE, dealLabel, whenLine } from '../../models/food/promotionModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, EmptyState, InlineNotice, ScreenShell, RowCardsSkeleton } from '../../Custom-Components/index';
import { RowCard } from '../../Components/admin/AdminParts';
import type { FoodPromotion, FoodVendorStackParamList } from '../../models';
import { loadPromotionsAsync, selectVendorPromotions } from './vendorPromotionsSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorPromotions'>;

const makeStyles = ({ space, gutter }: Theme) =>
  StyleSheet.create({
    list: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s12 },
  });

/** A deal as a row card: its name and what it gives, ONE pill, when and how often it's used. */
const PromotionCard: React.FC<{ p: FoodPromotion; onPress: () => void }> = ({ p, onPress }) => {
  const state = PROMOTION_STATE[p.state];
  return (
    <RowCard
      title={p.title}
      mark={{ icon: 'pricetag-outline', tint: 'amber' }}
      lines={[p.label || dealLabel(p), [p.code ? `Code ${p.code}` : 'Applies by itself', whenLine(p)].join(' · ')]}
      pill={{ label: state.label, tone: state.tone }}
      foot={{
        left: [p.usedCount ? `Used on ${p.usedCount} ${p.usedCount === 1 ? 'order' : 'orders'}` : 'Not used yet', p.usageLimit ? `up to ${p.usageLimit}` : null, p.firstOrderOnly ? 'first orders only' : null]
          .filter(Boolean)
          .join(' · '),
      }}
      chevron
      onPress={onPress}
    />
  );
};

const VendorPromotions: React.FC<Props> = props => (
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
    <ScreenShell
      title="Deals"
      subtitle="You fund each one; MetroMatrix takes nothing"
      onBack={back}
      scroll={false}
      padded={false}
      footer={<Button label="New deal" leftIcon="add" onPress={() => navigation.navigate('VendorPromotion')} fullWidth />}>
      <FlatList
        data={s.items}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        refreshing={s.status === 'loading' && s.items.length > 0}
        onRefresh={() => void dispatch(loadPromotionsAsync())}
        ListHeaderComponent={
          <AppText variant="small" tone="muted">
            Customers get one deal per order, the one that saves them most. A deal with a code applies only when they type it.
          </AppText>
        }
        renderItem={({ item }) => <PromotionCard p={item} onPress={() => navigation.navigate('VendorPromotion', { id: item.id })} />}
        ListEmptyComponent={
          s.status === 'loading' ? (
            <RowCardsSkeleton count={3} />
          ) : s.status === 'failed' ? (
            <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadPromotionsAsync()) }} />
          ) : (
            <EmptyState ion="pricetag-outline" title="No deals yet" body="A deal shows on your card and menu, and brings customers back. Start with free delivery or a share off." />
          )
        }
      />
    </ScreenShell>
  );
};

export default VendorPromotions;
