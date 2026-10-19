// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: a purchase
// ═══════════════════════════════════════════════════════
// What was bought, how much, what it cost (and per kilo, litre or piece),
// when it expires, from whom, and the receipt photo if there was one.

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { qtyLabel } from '@models/kitchen/stockModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Card, Divider, ImageViewer, InlineNotice, ListRow, ScreenShell, SkeletonLines } from '@custom/index';
import type { FoodVendorStackParamList } from '@/types';
import { formatDayFull } from '@utils/healthTime';
import { formatPKR } from '@utils/money';
import { formatUnitPrice } from '@utils/units';
import { loadPurchaseAsync, selectPurchase } from './purchaseSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenPurchase'>;

const SOURCE = { manual: 'Typed in', receipt: 'Scanned from a receipt', voice: 'Spoken' } as const;

const makeStyles = ({ space, size, radius, colors }: Theme) =>
  StyleSheet.create({
    line: { flexDirection: 'row', gap: space.s12, paddingVertical: space.s12, alignItems: 'flex-start' },
    grow: { flex: 1, gap: space.s4 },
    end: { alignItems: 'flex-end', gap: space.s4 },
    total: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.s12 },
    receipt: { width: '100%', aspectRatio: size.productAspect, borderRadius: radius.lg, backgroundColor: colors.surfaceSunk },
  });

const PurchaseScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <PurchaseContent {...props} />
  </ServiceScope>
);

const PurchaseContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'KitchenPurchases' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectPurchase);
  const [viewing, setViewing] = useState(false);
  const p = s.purchase?.id === route.params.id ? s.purchase : null;

  useEffect(() => {
    void dispatch(loadPurchaseAsync(route.params.id));
  }, [dispatch, route.params.id]);

  return (
    <ScreenShell title={p ? formatPKR(p.total) : 'Purchase'} subtitle={p ? `${formatDayFull(p.date)}${p.supplier ? ` · ${p.supplier.name}` : ''}` : undefined} onBack={back}>
      {s.status === 'failed' && !p ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadPurchaseAsync(route.params.id)) }} /> : null}
      {!p && s.status !== 'failed' ? <SkeletonLines lines={6} /> : null}
      {p ? (
        <>
          <Card padded="horizontal">
            {p.lines.map((l, n) => (
              <View key={l.id}>
                {n > 0 ? <Divider /> : null}
                <Pressable style={styles.line} onPress={() => navigation.navigate('KitchenIngredient', { id: l.ingredientId })} accessibilityRole="button" accessibilityLabel={`${l.name}, ${qtyLabel(l, l.qty)}, ${formatPKR(l.total)}`}>
                  <View style={styles.grow}>
                    <AppText variant="bodyStrong">{l.name}</AppText>
                    <AppText variant="caption" tone="muted">
                      {qtyLabel(l, l.qty)} · {formatUnitPrice(l.costPerBase, l.baseUnit)}
                      {l.expiresOn ? ` · expires ${formatDayFull(l.expiresOn)}` : ''}
                    </AppText>
                  </View>
                  <AppText variant="bodyStrong">{formatPKR(l.total)}</AppText>
                </Pressable>
              </View>
            ))}
            <Divider />
            <View style={styles.total}>
              <AppText variant="bodyStrong">Total</AppText>
              <AppText variant="title">{formatPKR(p.total)}</AppText>
            </View>
          </Card>
          <Card padded="horizontal">
            <ListRow title={SOURCE[p.source]} leftIcon={p.source === 'receipt' ? 'receipt-outline' : p.source === 'voice' ? 'mic-outline' : 'create-outline'} chevron={false} />
          </Card>
          {p.receiptUrl ? (
            <Pressable onPress={() => setViewing(true)} accessibilityRole="imagebutton" accessibilityLabel="The receipt photo. Open it">
              <Image source={{ uri: p.receiptUrl }} style={styles.receipt} contentFit="cover" />
            </Pressable>
          ) : null}
          <ImageViewer visible={viewing} uri={p.receiptUrl} title="Receipt" onClose={() => setViewing(false)} />
        </>
      ) : null}
    </ScreenShell>
  );
};

export default PurchaseScreen;
