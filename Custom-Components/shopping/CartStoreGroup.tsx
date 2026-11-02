// ═══════════════════════════════════════════════════════
// CartStoreGroup — one store's part of the Bag
// ═══════════════════════════════════════════════════════
// Each store ships, prices delivery and confirms on its own, so the Bag is
// grouped by store: its head row, its lines (each with what changed since it
// was added, a stepper and the bin), and one line on delivery: its fee and
// how much more for free delivery. The Bag's foot carries the one total.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { CartGroup, CartLine } from '../../models/shopping';
import { formatPKR } from '../../utils/money/money';
import { AppText } from '../AppText';
import { Card } from '../Card';
import { Divider } from '../Divider';
import { IconButton } from '../IconButton';
import { IonIcon } from '../Icon';
import { InlineNotice } from '../InlineNotice';
import { LineItemRow } from './LineItemRow';
import { QuantityStepper } from './QuantityStepper';
import { StoreHeadRow } from './StoreHeadRow';

export interface CartStoreGroupProps {
  group: CartGroup;
  onQuantity: (lineId: string, quantity: number) => void;
  onRemove: (line: CartLine) => void;
  onOpenStore: () => void;
  onOpenProduct: (productId: string) => void;
  /** The line a change is in flight for (its controls rest). */
  busyLineId?: string | null;
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    lineFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.s4 },
    foot: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    footText: { flex: 1 },
  });

/** "Delivery Rs 250 · Add Rs 1,200 more for free delivery" */
const deliveryLine = (g: CartGroup) =>
  g.shippingFee === 0
    ? 'Free delivery'
    : g.toFreeShipping
      ? `Delivery ${formatPKR(g.shippingFee)} · Add ${formatPKR(g.toFreeShipping)} more for free delivery`
      : `Delivery ${formatPKR(g.shippingFee)}`;

export const CartStoreGroup: React.FC<CartStoreGroupProps> = ({
  group,
  onQuantity,
  onRemove,
  onOpenStore,
  onOpenProduct,
  busyLineId,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const items = group.lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <Card>
      <StoreHeadRow
        store={group.store}
        meta={`${items} ${items === 1 ? 'item' : 'items'} · ${formatPKR(group.subtotal)}`}
        onPress={onOpenStore}
        accessibilityLabel={`${group.store.name}, ${items} items. Open the store`}
      />

      {group.warnings.map(w => (
        <InlineNotice key={w.code} tone="warning" message={w.message} embedded />
      ))}

      {group.lines.map((line, i) => {
        const busy = busyLineId === line.id;
        const soldOut = line.warnings.some(w => w.code === 'OUT_OF_STOCK');
        return (
          <React.Fragment key={line.id}>
            {i > 0 ? <Divider /> : null}
            <LineItemRow
              imageUrl={line.imageUrl}
              name={line.name}
              meta={line.variantLabel || null}
              price={formatPKR(line.lineTotal)}
              soldOut={soldOut}
              onOpen={() => onOpenProduct(line.productId)}>
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
            </LineItemRow>
          </React.Fragment>
        );
      })}

      <Divider />
      <View style={styles.foot}>
        <IonIcon name="car-outline" size="md" color={group.shippingFee === 0 ? colors.success : service.accentDeep} />
        <AppText variant="small" tone={group.shippingFee === 0 ? 'success' : 'muted'} style={styles.footText}>
          {deliveryLine(group)}
        </AppText>
      </View>
    </Card>
  );
};

export default CartStoreGroup;
