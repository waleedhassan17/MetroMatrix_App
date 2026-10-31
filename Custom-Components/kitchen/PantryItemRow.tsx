// PantryItemRow — one thing in the customer's kitchen: its name, how much,
// and when it expires. Swipe left to mark it used, right to remove it; the
// same two actions are named for screen readers and in the row's menu.

import React, { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IconButton } from '../IconButton';
import { IonIcon } from '../Icon';
import { ExpiryChip } from './ExpiryChip';

export interface PantryItemRowProps {
  name: string;
  qtyLabel: string;
  expiresOn: string | null;
  today: string;
  onUse: () => void;
  onRemove: () => void;
  onPress?: () => void;
}

const makeStyles = ({ space, size, radius, colors, service }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingHorizontal: space.s16, minHeight: size.control.lg, backgroundColor: colors.surface },
    text: { flex: 1, gap: space.s4, paddingVertical: space.s12 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    use: { justifyContent: 'center', paddingHorizontal: space.s20, backgroundColor: service.accentSoft, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    remove: { justifyContent: 'center', paddingHorizontal: space.s20, backgroundColor: colors.dangerSoft, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  });

export const PantryItemRow: React.FC<PantryItemRowProps> = ({ name, qtyLabel, expiresOn, today, onUse, onRemove, onPress }) => {
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  const swipe = useRef<SwipeableMethods>(null);
  const done = (f: () => void) => () => {
    swipe.current?.close();
    f();
  };
  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableOpen={dir => (dir === 'left' ? done(onUse)() : done(onRemove)())}
      renderLeftActions={() => (
        <View style={styles.use}>
          <IonIcon name="checkmark" size="md" color={service.accentDeep} />
          <AppText variant="label" tone="accentDeep">
            Used
          </AppText>
        </View>
      )}
      renderRightActions={() => (
        <View style={styles.remove}>
          <AppText variant="label" tone="danger">
            Remove
          </AppText>
          <IonIcon name="trash-outline" size="md" color={colors.danger} />
        </View>
      )}>
      <Pressable
        onPress={onPress}
        style={styles.row}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${name}, ${qtyLabel}${expiresOn ? `, expires ${expiresOn}` : ''}`}
        accessibilityActions={[
          { name: 'use', label: 'Mark as used' },
          { name: 'remove', label: 'Remove' },
        ]}
        onAccessibilityAction={e => (e.nativeEvent.actionName === 'use' ? onUse() : onRemove())}>
        <View style={styles.text}>
          <AppText variant="title" numberOfLines={1}>
            {name}
          </AppText>
          <View style={styles.meta}>
            <AppText variant="small" tone="muted">
              {qtyLabel}
            </AppText>
            {expiresOn ? <ExpiryChip on={expiresOn} today={today} /> : null}
          </View>
        </View>
        <IconButton icon="checkmark-done-outline" tone="muted" onPress={onUse} accessibilityLabel={`Mark ${name} as used`} />
      </Pressable>
    </ReanimatedSwipeable>
  );
};

export default PantryItemRow;
