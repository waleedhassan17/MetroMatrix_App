// StoreHeadRow — a store's head inside a card (the Bag, checkout, an order):
// its round mark, its name, one muted line, and what the row ends with (an
// amount, a pill). Every store head is this one row, so they all look alike.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';
import { StoreMark, type StoreMarkSize } from './StoreCard';

export interface StoreHeadRowProps {
  store: { name: string; logoUrl: string | null; brandColor: string; onBrandColor?: string | null };
  /** One line under the name ("3 items · Pay Rs 4,200", an order's code). */
  meta?: string | null;
  /** At the row's end: an amount (text) or anything else (a pill). */
  trailing?: string | React.ReactNode;
  /** Opens the store (with a chevron, unless `chevron` is false). */
  onPress?: () => void;
  chevron?: boolean;
  markSize?: Extract<StoreMarkSize, 'sm' | 'md'>;
  accessibilityLabel?: string;
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    text: { flex: 1, gap: space.s4 },
  });

export const StoreHeadRow: React.FC<StoreHeadRowProps> = ({
  store,
  meta,
  trailing,
  onPress,
  chevron = true,
  markSize = 'md',
  accessibilityLabel,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, opacity } = useTheme();
  const body = (
    <>
      <StoreMark store={store} size={markSize} />
      <View style={styles.text}>
        <AppText variant="title" numberOfLines={1}>
          {store.name}
        </AppText>
        {meta ? (
          <AppText variant="small" tone="muted" numberOfLines={1}>
            {meta}
          </AppText>
        ) : null}
      </View>
      {typeof trailing === 'string' ? <AppText variant="bodyStrong">{trailing}</AppText> : trailing ?? null}
      {onPress && chevron ? <IonIcon name="chevron-forward" size="md" color={colors.inkFaint} /> : null}
    </>
  );
  const label = accessibilityLabel ?? [store.name, meta, typeof trailing === 'string' ? trailing : null].filter(Boolean).join(', ');
  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}>
      {body}
    </Pressable>
  );
};

export default StoreHeadRow;
