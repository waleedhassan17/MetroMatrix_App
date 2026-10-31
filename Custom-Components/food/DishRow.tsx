// DishRow — one dish in the vendor's menu: its photo, name, price and a line
// of detail (sizes, days, "Off until 4:30 PM"), with the switch that takes it
// off the menu. Tapping the row opens the dish; the switch only switches.

import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';
import { cdn } from '../../utils/cdn/cdn';

export interface DishRowProps {
  name: string;
  price: string;
  photoUrl: string | null;
  /** "3 sizes · Thu–Sat", "Hidden from customers". */
  detail?: string;
  /** Shown in warning ink when the dish is off: "Off until 4:30 PM". */
  offLabel?: string | null;
  available: boolean;
  /** Hidden by the vendor (not just off for now). */
  hidden?: boolean;
  saving?: boolean;
  onPress: () => void;
  onToggle: (next: boolean) => void;
}

const makeStyles = ({ space, size, radius, colors, opacity }: Theme) =>
  StyleSheet.create({
    root: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12, minHeight: size.control.lg },
    thumb: {
      width: size.thumb,
      height: size.thumb,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceSunk,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    fill: { ...StyleSheet.absoluteFillObject },
    text: { flex: 1, gap: space.s4 },
    main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    dim: { opacity: opacity.soldOut },
  });

export const DishRow: React.FC<DishRowProps> = ({ name, price, photoUrl, detail, offLabel, available, hidden, saving, onPress, onToggle }) => {
  const styles = useStyles(makeStyles);
  const { colors, service, size } = useTheme();
  return (
    <View style={styles.root}>
      <Pressable
        onPress={onPress}
        style={styles.main}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${price}${available ? '' : ', off'}`}
        accessibilityHint="Opens the dish"
      >
        <View style={[styles.thumb, !available && styles.dim]}>
          {photoUrl ? (
            <Image source={{ uri: cdn(photoUrl, { w: size.thumb, h: size.thumb }) ?? undefined }} style={styles.fill} contentFit="cover" />
          ) : (
            <IonIcon name="restaurant-outline" size="md" color={colors.inkFaint} />
          )}
        </View>
        <View style={styles.text}>
          <AppText variant="bodyStrong" tone={available && !hidden ? 'ink' : 'muted'} numberOfLines={2}>
            {name}
          </AppText>
          <AppText variant="small" tone="muted" numberOfLines={1}>
            {detail ? `${price} · ${detail}` : price}
          </AppText>
          {offLabel ? (
            <AppText variant="small" tone="warning" numberOfLines={1}>
              {offLabel}
            </AppText>
          ) : null}
        </View>
      </Pressable>
      <Switch
        value={available}
        onValueChange={onToggle}
        disabled={saving}
        trackColor={{ false: colors.disabled, true: service.accent }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.disabled}
        {...({ activeThumbColor: colors.surface } as object)}
        accessibilityRole="switch"
        accessibilityLabel={`${name} can be ordered`}
        aria-checked={available}
        aria-disabled={!!saving}
      />
    </View>
  );
};

export default DishRow;
