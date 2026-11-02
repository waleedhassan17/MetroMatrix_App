// ═══════════════════════════════════════════════════════
// MetroMatrix — Order placed
// ═══════════════════════════════════════════════════════
// The FYP's confirmation: a success mark (a ring round a solid disc), the
// order's code to copy, and ONE card listing each store with its total and
// how it's paid — and, for a transfer, that the store is waiting for it.
// Stateless: the group is in the order-detail slice already (checkout put it
// there).

import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { needsPayment, PAYMENT_METHOD_LABEL } from '../../models/shopping/orderStatusModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  BagGroupSkeleton,
  Button,
  Card,
  Divider,
  InlineNotice,
  IonIcon,
  StickyCTA,
  StoreHeadRow,
  TextAction,
} from '../../Custom-Components/index';
import type { ShopBrowseParamList } from '../../models';
import { timeLeft } from '../../utils/dates/dates';
import { formatPKR } from '../../utils/money/money';
import { loadOrderGroupAsync, selectOrderGroup } from '../order-detail-screen/orderDetailSlice';

type Props = NativeStackScreenProps<ShopBrowseParamList, 'OrderPlaced'>;

const itemCount = (o: { items: { quantity: number }[] }) => o.items.reduce((n, i) => n + i.quantity, 0);

const makeStyles = ({ colors, space, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s20 },
    hero: { alignItems: 'center', gap: space.s12, paddingVertical: space.s32 },
    ring: {
      width: size.successRing,
      height: size.successRing,
      borderRadius: radius.pill,
      backgroundColor: colors.successSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: space.s8,
    },
    disc: {
      width: size.successDisc,
      height: size.successDisc,
      borderRadius: radius.pill,
      backgroundColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    code: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      paddingHorizontal: space.s16,
      paddingVertical: space.s8,
      borderRadius: radius.pill,
      borderWidth: size.hairline,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    store: { gap: space.s12 },
  });

const OrderPlaced: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <OrderPlacedContent {...props} />
  </ServiceScope>
);

const OrderPlacedContent: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const insets = useSafeAreaInsets();
  const root = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const { groupCode } = route.params;
  const e = useAppSelector(s => selectOrderGroup(s, groupCode));
  const g = e.group;

  useEffect(() => {
    if (e.status === 'idle') void dispatch(loadOrderGroupAsync(groupCode));
  }, [e.status, groupCode, dispatch]);

  // Back to the Shopping tabs, then the order over them (or the shop's Home tab).
  const leave = (to: 'order' | 'shop') => {
    navigation.popToTop();
    if (to === 'order') root.navigate('OrderDetail', { groupCode });
    else root.navigate('ShopTabs', { screen: 'ShopHomeTab' });
  };

  const copy = async () => {
    await Clipboard.setStringAsync(groupCode);
    Toast.show({ type: 'success', text1: 'Order code copied' });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.ring} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.disc}>
              <IonIcon name="checkmark" size="xl" color={colors.onScrim} />
            </View>
          </View>
          <AppText variant="h1" align="center" accessibilityRole="header">
            Order placed
          </AppText>
          <AppText variant="body" tone="muted" align="center">
            We’ll tell you as each store confirms and ships it.
          </AppText>
          <Pressable onPress={() => void copy()} style={styles.code} accessibilityRole="button" accessibilityLabel={`Order ${groupCode}. Copy`}>
            <AppText variant="tag" tone="muted">
              ORDER
            </AppText>
            <AppText variant="bodyStrong">{groupCode}</AppText>
            <IonIcon name="copy-outline" size="sm" color={service.accentDeep} />
          </Pressable>
        </View>

        {!g ? (
          <BagGroupSkeleton />
        ) : (
          <Card>
            {g.orders.map((o, i) => {
              const owed = needsPayment(o);
              const left = o.paymentInstructions ? timeLeft(o.paymentInstructions.payBy) : null;
              return (
                <View key={o.id} style={styles.store}>
                  {i > 0 ? <Divider /> : null}
                  <StoreHeadRow
                    store={o.store}
                    meta={`${itemCount(o)} ${itemCount(o) === 1 ? 'item' : 'items'} · ${PAYMENT_METHOD_LABEL[o.paymentMethod]}`}
                    trailing={formatPKR(o.total)}
                  />
                  {owed ? (
                    <>
                      <InlineNotice
                        embedded
                        tone="warning"
                        title={`${o.store.name} is waiting for ${formatPKR(o.total)}`}
                        message={`${left ? `${left}. ` : ''}Transfer it to the store's own account, then share the transaction ID.`}
                      />
                      <TextAction label="See how to pay" icon="arrow-forward" onPress={() => leave('order')} />
                    </>
                  ) : null}
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
      <StickyCTA>
        <Button label="View order" onPress={() => leave('order')} fullWidth />
        <Button label="Continue shopping" variant="secondary" onPress={() => leave('shop')} fullWidth />
      </StickyCTA>
    </View>
  );
};

export default OrderPlaced;
