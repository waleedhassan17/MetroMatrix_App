// CtaBar — the FYP's sticky bottom bar on the product page and the Bag: what
// it comes to on the left (a small label, the amount, a muted line), the one
// primary action on the right. Sits inside StickyCTA.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '../../theme';
import { formatPKR } from '../../utils/money/money';
import { AppText } from '../AppText';
import { Button, type ButtonProps } from '../Button';

export interface CtaBarProps {
  /** "Total" */
  label?: string;
  amount: number;
  /** The struck "was" amount (a product on sale). */
  compareAt?: number | null;
  /** "3 items · delivery Rs 250" */
  note?: string | null;
  action: Pick<ButtonProps, 'label' | 'onPress' | 'disabled' | 'loading' | 'leftIcon' | 'rightIon' | 'accessibilityLabel'>;
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s16 },
    // The price never takes the button's room: a long note truncates instead.
    price: { flexShrink: 1, flexBasis: '45%', gap: space.s0 },
    amount: { flexDirection: 'row', alignItems: 'baseline', gap: space.s8 },
    was: { textDecorationLine: 'line-through' },
    action: { flex: 1 },
  });

export const CtaBar: React.FC<CtaBarProps> = ({ label, amount, compareAt, note, action }) => {
  const styles = useStyles(makeStyles);
  const was = compareAt && compareAt > amount ? compareAt : null;
  return (
    <View style={styles.row}>
      <View
        style={styles.price}
        accessible
        accessibilityLabel={[label, formatPKR(amount), was ? `was ${formatPKR(was)}` : null, note].filter(Boolean).join(', ')}>
        {label ? (
          <AppText variant="caption" tone="muted">
            {label}
          </AppText>
        ) : null}
        <View style={styles.amount}>
          <AppText variant="h2">{formatPKR(amount)}</AppText>
          {was ? (
            <AppText variant="caption" tone="muted" style={styles.was}>
              {formatPKR(was)}
            </AppText>
          ) : null}
        </View>
        {note ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {note}
          </AppText>
        ) : null}
      </View>
      <View style={styles.action}>
        <Button {...action} fullWidth />
      </View>
    </View>
  );
};

export default CtaBar;
