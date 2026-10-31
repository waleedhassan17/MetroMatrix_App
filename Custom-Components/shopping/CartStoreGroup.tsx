// ═══════════════════════════════════════════════════════
// CartStoreGroup — one store's part of the Bag
// ═══════════════════════════════════════════════════════
// Each store ships, prices delivery and confirms on its own, so the Bag is
// grouped by store: its mark and name, its lines (with what changed since
// they were added), and its own subtotal, delivery and free-delivery nudge.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { CartGroup, CartLine } from '../../types/shopping';
import { cdn } from '../../utils/cdn';
import { formatPKR } from '../../utils/money';
import { AppText } from '../AppText';
import { Card } from '../Card';
import { Divider } from '../Divider';
import { IconButton } from '../IconButton';
import { IonIcon } from '../Icon';
import { InlineNotice } from '../InlineNotice';
import { QuantityStepper } from './QuantityStepper';
import { StoreMark } from './StoreCard';

export interface CartStoreGroupProps {
  group: CartGroup;
  onQuantity: (lineId: string, quantity: number) => void;
  onRemove: (line: CartLine) => void;
  onOpenStore: () => void;
  onOpenProduct: (productId: string) => void;
  /** The line a change is in flight for (its controls rest). */
  busyLineId?: string | null;
}

const makeStyles = ({ colors, radius, space, size }: Theme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    headText: { flex: 1 },
    lineWrap: { gap: space.s16 },
    line: { flexDirection: 'row', gap: space.s12 },
    thumb: {
      width: size.lineThumb,
      aspectRatio: size.productAspect,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceSunk,
    },
    lineBody: { flex: 1, gap: space.s4 },
    lineFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.s4 },
    total: { flexDirection: 'row', justifyContent: 'space-between' },
    totals: { gap: space.s8 },
  });

const Row: React.FC<{ label: string; value: string; strong?: boolean; tone?: 'success' }> = ({ label, value, strong, tone }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.total}>
      <AppText variant={strong ? 'bodyStrong' : 'body'} tone={strong ? 'ink' : 'muted'}>
        {label}
      </AppText>
      <AppText variant={strong ? 'bodyStrong' : 'body'} tone={tone ?? 'ink'}>
        {value}
      </AppText>
    </View>
  );
};

export const CartStoreGroup: React.FC<CartStoreGroupProps> = ({
  group,
  onQuantity,
  onRemove,
  onOpenStore,
  onOpenProduct,
  busyLineId,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, size, opacity } = useTheme();

  return (
    <Card>
      <Pressable
        onPress={onOpenStore}
        accessibilityRole="button"
        accessibilityLabel={`${group.store.name}, open the store`}
        style={({ pressed }) => [styles.head, pressed && { opacity: opacity.pressed }]}>
        <StoreMark store={group.store} small />
        <View style={styles.headText}>
          <AppText variant="title" numberOfLines={1}>
            {group.store.name}
          </AppText>
        </View>
        <IonIcon name="chevron-forward" size="md" color={colors.inkFaint} />
      </Pressable>

      {group.warnings.map(w => (
        <InlineNotice key={w.code} tone="warning" message={w.message} />
      ))}

      {group.lines.map((line, i) => {
        const thumb = cdn(line.imageUrl, { w: size.lineThumb, h: size.lineThumb / size.productAspect });
        const busy = busyLineId === line.id;
        const soldOut = line.warnings.some(w => w.code === 'OUT_OF_STOCK');
        return (
          <View key={line.id} style={styles.lineWrap}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.line}>
              <Pressable onPress={() => onOpenProduct(line.productId)} accessibilityLabel={`Open ${line.name}`}>
                {thumb ? <Image source={{ uri: thumb }} style={[styles.thumb, soldOut && { opacity: opacity.soldOut }]} contentFit="cover" /> : <View style={styles.thumb} />}
              </Pressable>
              <View style={styles.lineBody}>
                <AppText variant="small" numberOfLines={2}>
                  {line.name}
                </AppText>
                {line.variantLabel ? (
                  <AppText variant="caption" tone="muted">
                    {line.variantLabel}
                  </AppText>
                ) : null}
                <AppText variant="bodyStrong">{formatPKR(line.lineTotal)}</AppText>
                {line.warnings.map(w => (
                  <AppText key={w.code} variant="caption" tone={w.code === 'PRICE_CHANGED' ? 'warning' : 'danger'}>
                    {w.message}
                  </AppText>
                ))}
                <View style={styles.lineFoot}>
                  {soldOut ? (
                    <View />
                  ) : (
                    <QuantityStepper
                      value={line.quantity}
                      max={Math.max(line.quantity, line.available)}
                      onChange={q => onQuantity(line.id, q)}
                      disabled={busy}
                      label={`Quantity of ${line.name}`}
                    />
                  )}
                  <IconButton icon="trash-outline" tone="muted" onPress={() => onRemove(line)} accessibilityLabel={`Remove ${line.name}`} disabled={busy} />
                </View>
              </View>
            </View>
          </View>
        );
      })}

      <Divider />
      <View style={styles.totals}>
        <Row label="Subtotal" value={formatPKR(group.subtotal)} />
        <Row
          label="Delivery"
          value={group.shippingFee === 0 ? 'Free' : formatPKR(group.shippingFee)}
          tone={group.shippingFee === 0 ? 'success' : undefined}
        />
        {group.toFreeShipping ? (
          <AppText variant="caption" tone="accentDeep">
            Add {formatPKR(group.toFreeShipping)} more from {group.store.name} for free delivery.
          </AppText>
        ) : null}
      </View>
    </Card>
  );
};

export default CartStoreGroup;
