// ═══════════════════════════════════════════════════════
// MetroMatrix — Bag
// ═══════════════════════════════════════════════════════
// Grouped by store, because each store prices delivery, ships and confirms
// on its own. Whatever changed since you added it (price, stock, a store
// taking a break) is said on the line, and checkout waits until it's dealt
// with. Totals are always the server's.

import React, { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useIsTabRoot } from '@hooks/useServiceNav';
import { useShopNav } from '@hooks/useShop';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, CartStoreGroup, EmptyState, InlineNotice, SkeletonLines, StickyCTA } from '@custom/index';
import { SectionError, ShopTopBar } from '@components/shopping/ShopParts';
import type { CartLine, ShopBrowseParamList } from '@/types';
import { formatPKR } from '@utils/money';
import { acknowledgeBagAsync, addToBagAsync, loadBagAsync, removeLineAsync, selectBag, updateLineAsync } from './bagSlice';

type Props = NativeStackScreenProps<ShopBrowseParamList, 'Bag'>;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: gutter, paddingTop: space.s8, paddingBottom: space.s40, gap: space.s16 },
    total: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  });

const BagScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <BagContent {...props} />
  </ServiceScope>
);

const BagContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'ShoppingHome' });
  const asTab = useIsTabRoot();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const b = useAppSelector(selectBag);
  const { openStore, openProduct } = useShopNav();
  const root = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const cart = b.cart;

  // The server may have new prices or stock since this was last seen.
  useFocusEffect(
    useCallback(() => {
      void dispatch(loadBagAsync());
    }, [dispatch]),
  );

  const remove = async (line: CartLine) => {
    const r = await dispatch(removeLineAsync(line.id));
    if (removeLineAsync.fulfilled.match(r) && line.available > 0) {
      Toast.show({
        type: 'info',
        text1: `Removed ${line.name}`,
        text2: 'Tap to put it back.',
        onPress: () => {
          Toast.hide();
          void dispatch(addToBagAsync({ variantId: line.variantId, quantity: Math.min(line.quantity, line.available) }));
        },
      });
    }
  };

  const priceChanges = cart.groups.flatMap(g => g.lines).filter(l => l.warnings.some(w => w.code === 'PRICE_CHANGED'));
  const otherProblems = cart.groups.some(g => g.isPaused || g.lines.some(l => l.warnings.some(w => w.code !== 'PRICE_CHANGED')));

  return (
    <View style={styles.root}>
      <ShopTopBar title="Bag" onBack={asTab ? undefined : back} showBag={false} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={b.refreshing} onRefresh={() => void dispatch(loadBagAsync({ refresh: true }))} tintColor={service.accent} />}>
        {b.status === 'failed' && !cart.groups.length ? (
          <SectionError message={b.error.message} onRetry={() => void dispatch(loadBagAsync())} />
        ) : b.status === 'loading' && !cart.groups.length && !b.refreshing ? (
          <SkeletonLines lines={6} />
        ) : !cart.groups.length ? (
          <EmptyState
            icon="shopping-bag"
            title="Your bag is empty"
            body="Add something you love from any store. Each store delivers its own items."
            action={{ label: 'Start shopping', onPress: () => root.navigate('ShopTabs', { screen: 'ShopHomeTab' }) }}
          />
        ) : (
          <>
            {b.actionError.message ? <InlineNotice message={b.actionError.message} /> : null}
            {priceChanges.length ? (
              <InlineNotice
                tone="warning"
                title={priceChanges.length === 1 ? 'A price changed' : `${priceChanges.length} prices changed`}
                message="Stores can change prices. Check the new totals below."
                action={{ label: 'Accept new prices', onPress: () => void dispatch(acknowledgeBagAsync(priceChanges.map(l => l.id))) }}
              />
            ) : null}
            {cart.groups.map(g => (
              <CartStoreGroup
                key={g.store.id}
                group={g}
                busyLineId={b.busyLineId}
                onQuantity={(lineId, quantity) => void dispatch(updateLineAsync({ lineId, quantity }))}
                onRemove={line => void remove(line)}
                onOpenStore={() => openStore(g.store.slug, g.store.name)}
                onOpenProduct={productId => openProduct(productId)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {cart.groups.length ? (
        <StickyCTA>
          <View style={styles.total}>
            <AppText variant="body" tone="muted">
              {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'} · delivery {cart.shippingTotal ? formatPKR(cart.shippingTotal) : 'free'}
            </AppText>
            <AppText variant="title">{formatPKR(cart.total)}</AppText>
          </View>
          {otherProblems ? (
            <AppText variant="caption" tone="danger">
              Remove sold-out items, lower quantities above what’s left, or wait for paused stores.
            </AppText>
          ) : null}
          <Button
            label="Checkout"
            rightIon="arrow-forward"
            onPress={() => navigation.navigate('Checkout')}
            disabled={cart.blocking}
            fullWidth
          />
        </StickyCTA>
      ) : null}
    </View>
  );
};

export default BagScreen;
