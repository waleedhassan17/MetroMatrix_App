// ═══════════════════════════════════════════════════════
// RiderPill — a vendor's rider at a glance
// ═══════════════════════════════════════════════════════
// Initials, name and vehicle; a duty dot (on duty or not), a live-location
// dot (the phone reported in the last 2 minutes), and how many orders the
// rider is carrying. Two dots on purpose: on duty is the rider's choice,
// a live location is the phone's.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../AppText';
import { StatusPill } from '../StatusPill';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { FoodRider } from '../../types/food';
import { riderStatusLabel, riderVehicleLabel } from '../../models/food/vendorModel';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('');

const makeStyles = ({ colors, service, space, size, radius }: Theme) =>
  StyleSheet.create({
    root: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12 },
    mark: {
      width: size.avatar.md,
      height: size.avatar.md,
      borderRadius: radius.pill,
      backgroundColor: service.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flex: 1, gap: space.s4 },
    dots: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    dotRow: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    dot: { width: size.eyebrowDot, height: size.eyebrowDot, borderRadius: radius.pill },
    off: { backgroundColor: colors.lineStrong },
  });

export const RiderPill: React.FC<{ rider: FoodRider; onPress?: () => void }> = ({ rider, onPress }) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const active = rider.status === 'active';
  const label = `${rider.fullName}, ${riderVehicleLabel(rider.vehicle)}. ${active ? (rider.onDuty ? 'On duty' : 'Off duty') : riderStatusLabel(rider.status)}. ${
    rider.locationLive ? 'Location live.' : 'No live location.'
  } ${rider.activeOrderCount} active orders.`;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.root} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={label}>
      <View style={styles.mark}>
        <AppText variant="bodyStrong" tone="accentDeep">
          {initials(rider.fullName)}
        </AppText>
      </View>
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {rider.fullName}
        </AppText>
        <View style={styles.dots}>
          {active ? (
            <View style={styles.dotRow}>
              <View style={[styles.dot, rider.onDuty ? { backgroundColor: colors.success } : styles.off]} />
              <AppText variant="small" tone="muted">
                {rider.onDuty ? 'On duty' : 'Off duty'}
              </AppText>
            </View>
          ) : null}
          <View style={styles.dotRow}>
            <View style={[styles.dot, rider.locationLive ? { backgroundColor: service.accent } : styles.off]} />
            <AppText variant="small" tone="muted">
              {rider.locationLive ? 'Location live' : riderVehicleLabel(rider.vehicle)}
            </AppText>
          </View>
          {rider.activeOrderCount ? (
            <AppText variant="small" tone="muted">{`${rider.activeOrderCount} active`}</AppText>
          ) : null}
        </View>
      </View>
      {!active ? <StatusPill label={riderStatusLabel(rider.status)} tone={rider.status === 'plan_locked' ? 'warning' : 'neutral'} /> : null}
    </Pressable>
  );
};

export default RiderPill;
