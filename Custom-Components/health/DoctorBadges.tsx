// DoctorBadges — "PMDC verified" and "Top booked" as micro pills.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { DoctorBadge } from '../../types/health';
import { AppText } from '../AppText';
import { IonIcon, type IonName } from '../Icon';

const BADGE: Record<DoctorBadge, { label: string; icon: IonName }> = {
  pmdc_verified: { label: 'PMDC verified', icon: 'shield-checkmark' },
  top_booked: { label: 'Top booked', icon: 'trending-up' },
};

const makeStyles = ({ space, radius }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s4 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: space.s4, paddingHorizontal: space.s8, paddingVertical: space.s4, borderRadius: radius.pill },
  });

export const DoctorBadges: React.FC<{ badges: DoctorBadge[] }> = ({ badges }) => {
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  if (!badges.length) return null;
  return (
    <View style={styles.row}>
      {badges.map(b => (
        <View key={b} style={[styles.pill, { backgroundColor: b === 'pmdc_verified' ? service.accentSoft : colors.warningSoft }]}>
          <IonIcon name={BADGE[b].icon} size="sm" color={b === 'pmdc_verified' ? service.accentDeep : colors.warning} />
          <AppText variant="micro" style={{ color: b === 'pmdc_verified' ? service.accentDeep : colors.warning }}>
            {BADGE[b].label}
          </AppText>
        </View>
      ))}
    </View>
  );
};

export default DoctorBadges;
