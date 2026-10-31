// PaymentMethodPicker — cash on delivery or a transfer, for one store. An
// option the store can't take for this order stays visible with the reason.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { PAYMENT_METHOD_LABEL } from '../../models/shopping/orderStatusModel';
import type { PaymentMethod, PaymentOption } from '../../models/shopping';
import { AppText } from '../AppText';
import { IonIcon, type IonName } from '../Icon';

const HELP: Record<PaymentMethod, string> = {
  cod: 'Pay the rider in cash when it arrives.',
  transfer: 'Send the amount by Raast, wallet or bank, then share the transaction ID.',
};
const ICON: Record<PaymentMethod, IonName> = { cod: 'cash-outline', transfer: 'swap-horizontal-outline' };

const makeStyles = ({ colors, radius, space, size }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s8 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s12,
      padding: space.s12,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderColor: colors.line,
    },
    text: { flex: 1, gap: space.s4 },
    radio: {
      width: size.icon.md,
      height: size.icon.md,
      borderRadius: radius.pill,
      borderWidth: size.focusBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioDot: { width: size.icon.sm / 2, height: size.icon.sm / 2, borderRadius: radius.pill },
  });

export const PaymentMethodPicker: React.FC<{
  options: PaymentOption[];
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}> = ({ options, value, onChange }) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  return (
    <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel="Payment method">
      {options.map(o => {
        const selected = o.method === value && o.available;
        return (
          <Pressable
            key={o.method}
            onPress={() => o.available && onChange(o.method)}
            disabled={!o.available}
            accessibilityRole="radio"
            aria-checked={selected}
            aria-disabled={!o.available}
            accessibilityLabel={`${PAYMENT_METHOD_LABEL[o.method]}${o.reason ? `. ${o.reason}` : ''}`}
            style={[
              styles.option,
              selected && { borderColor: service.accent, backgroundColor: service.accentSoft },
              !o.available && { backgroundColor: colors.surfaceSunk },
            ]}>
            <IonIcon name={ICON[o.method]} size="lg" color={o.available ? service.accentDeep : colors.inkFaint} />
            <View style={styles.text}>
              <AppText variant="bodyStrong" tone={o.available ? 'ink' : 'faint'}>
                {PAYMENT_METHOD_LABEL[o.method]}
              </AppText>
              <AppText variant="small" tone="muted">
                {o.reason ?? HELP[o.method]}
              </AppText>
            </View>
            <View style={[styles.radio, { borderColor: selected ? service.accent : colors.lineStrong }]}>
              {selected ? <View style={[styles.radioDot, { backgroundColor: service.accent }]} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

export default PaymentMethodPicker;
