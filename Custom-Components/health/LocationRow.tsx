// ═══════════════════════════════════════════════════════
// LocationRow — one way to see the doctor: video, or a clinic
// ═══════════════════════════════════════════════════════
// Choosing a row is choosing how and where you'll be seen: icon, name, area,
// the fee on the right, when they're next free, and a "Timings" disclosure
// with the weekly hours. Selected = accent border and a soft fill. A clinic
// row links to directions.

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { PracticeLocation } from '../../types/health';
import { formatPKR } from '../../utils/money';
import { openDirections } from '../../utils/maps';
import { AppText } from '../AppText';
import { IonIcon } from '../Icon';
import { TextAction } from '../TextAction';
import { AvailabilityChip } from './AvailabilityChip';

const makeStyles = ({ colors, space, radius, size }: Theme) =>
  StyleSheet.create({
    root: { borderRadius: radius.md, borderWidth: size.border, borderColor: colors.line, backgroundColor: colors.surface },
    main: { flexDirection: 'row', gap: space.s12, padding: space.s16, paddingBottom: space.s8, minHeight: size.touch },
    well: { width: size.icon.xl + space.s8, height: size.icon.xl + space.s8, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    text: { flex: 1, gap: space.s4 },
    top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
    name: { flex: 1 },
    links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s16, paddingHorizontal: space.s16, paddingBottom: space.s12 },
    timings: { gap: space.s4, paddingHorizontal: space.s16, paddingBottom: space.s16 },
    timing: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12 },
  });

export const LocationRow: React.FC<{ location: PracticeLocation; selected: boolean; onSelect: () => void }> = ({ location: l, selected, onSelect }) => {
  const styles = useStyles(makeStyles);
  const { service, colors, size } = useTheme();
  const [open, setOpen] = useState(false);
  const video = l.kind === 'video';
  const where = video ? 'From home, on your phone' : [l.area, l.city].filter(Boolean).join(', ');
  return (
    <View style={[styles.root, selected && { borderColor: service.accent, borderWidth: size.focusBorder, backgroundColor: service.accentSoft }]}>
      <Pressable
        onPress={onSelect}
        accessibilityRole="radio"
        aria-selected={selected}
        accessibilityLabel={`${l.name}, ${where}, fee ${formatPKR(l.fee)}${l.availability.label ? `, ${l.availability.label}` : ''}`}
        style={styles.main}>
        <View style={[styles.well, { backgroundColor: selected ? colors.surface : service.accentSoft }]}>
          <IonIcon name={video ? 'videocam-outline' : 'business-outline'} size="md" color={service.accentDeep} />
        </View>
        <View style={styles.text}>
          <View style={styles.top}>
            <AppText variant="title" style={styles.name}>
              {l.name}
            </AppText>
            <AppText variant="bodyStrong">{formatPKR(l.fee)}</AppText>
          </View>
          <AppText variant="small" tone="muted">
            {where}
          </AppText>
          {video && l.requiresPrepay ? (
            <AppText variant="caption" tone="muted">
              Pay the doctor by transfer before the consultation
            </AppText>
          ) : null}
          <AvailabilityChip availability={l.availability} />
        </View>
      </Pressable>
      <View style={styles.links}>
        {l.timings.length ? (
          <TextAction label={open ? 'Hide timings' : 'Timings'} icon={open ? 'chevron-up' : 'chevron-down'} onPress={() => setOpen(o => !o)} />
        ) : null}
        {!video ? <TextAction label="Directions" icon="navigate-outline" onPress={() => void openDirections(l)} accessibilityLabel={`Directions to ${l.name}`} /> : null}
      </View>
      {open ? (
        <View style={styles.timings}>
          {l.timings.map(t => (
            <View key={t.days} style={styles.timing}>
              <AppText variant="small">{t.days}</AppText>
              <AppText variant="small" tone="muted" align="right">
                {t.hours}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

export default LocationRow;
