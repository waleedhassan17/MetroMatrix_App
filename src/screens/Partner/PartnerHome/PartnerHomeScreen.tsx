// ═══════════════════════════════════════════════════════
// MetroMatrix — Partner home (approved provider)
// ═══════════════════════════════════════════════════════
// The approved provider's landing, in the FYP home's frame: the brand
// centred, a "Live" badge, then their business as one card in their
// service's colour (the partner navigator wraps the app in <ServiceScope>).
// Menu, catalogue and schedule tools arrive in the next chunk. Stateless.

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '@hooks/useReduxHooks';
import { SERVICE_LABELS, SUBTYPE_LABELS } from '@models/businessModel';
import { useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, IonIcon, MciIcon, type IonName, type MciName } from '@custom/index';
import type { ServiceType } from '@/types';
import { selectBusiness } from '../../Auth/authSlice';

const GLYPH: Record<ServiceType, MciName> = {
  shopping: 'storefront-outline',
  healthcare: 'stethoscope',
  food: 'silverware-fork-knife',
};

const NEXT: Record<ServiceType, { icon: IonName; title: string; body: string }[]> = {
  food: [
    { icon: 'restaurant-outline', title: 'Your menu', body: 'Add dishes, prices and photos.' },
    { icon: 'receipt-outline', title: 'Live orders', body: 'Accept, prepare and hand over to riders.' },
  ],
  healthcare: [
    { icon: 'calendar-outline', title: 'Your schedule', body: 'Set clinic hours and video slots.' },
    { icon: 'people-outline', title: 'Appointments', body: 'See who is booked and when.' },
  ],
  shopping: [
    { icon: 'pricetags-outline', title: 'Your catalogue', body: 'List products, stock and prices.' },
    { icon: 'cube-outline', title: 'Orders', body: 'Pack and dispatch customer orders.' },
  ],
};

const makeStyles = ({ colors, space, gutter, size, radius, elevation }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s20 },
    header: { alignItems: 'center', paddingTop: space.s12 },
    live: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      paddingHorizontal: space.s12,
      paddingVertical: space.s8,
      borderRadius: radius.pill,
    },
    liveDot: { width: space.s8, height: space.s8, borderRadius: radius.pill, backgroundColor: colors.success },
    card: {
      gap: space.s16,
      padding: space.s20,
      borderRadius: radius.xl,
      borderWidth: size.hairline,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      ...elevation.raised,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.s16 },
    tile: { width: size.tile, height: size.tile, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
    grow: { flex: 1, gap: space.s4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    next: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s12,
      padding: space.s16,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceSunk,
    },
  });

const PartnerHomeScreen: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const business = useAppSelector(selectBusiness);
  if (!business) return null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header} accessibilityRole="header">
          <AppText variant="logo" tone="brand">
            MetroMatrix
          </AppText>
          <AppText variant="body" tone="muted">
            {SERVICE_LABELS[business.serviceType].partnerTitle}
          </AppText>
        </View>

        <View style={[styles.live, { backgroundColor: colors.successSoft }]}>
          <View style={styles.liveDot} />
          <AppText variant="micro" tone="success">
            APPROVED · LIVE
          </AppText>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={[styles.tile, { backgroundColor: service.accentSoft }]}>
              <MciIcon name={GLYPH[business.serviceType]} size="xl" color={service.accent} />
            </View>
            <View style={styles.grow}>
              <AppText variant="h2" numberOfLines={2}>
                {business.name}
              </AppText>
              <AppText variant="small" tone="accentDeep">
                {SUBTYPE_LABELS[business.subType].title}
              </AppText>
            </View>
          </View>
          <View style={styles.row}>
            <IonIcon name="location-outline" size="sm" color={colors.inkMuted} />
            <AppText variant="small" tone="muted" style={styles.grow}>
              {[business.address, business.city].filter(Boolean).join(', ')}
            </AppText>
          </View>
        </View>

        <AppText variant="h2" accessibilityRole="header">
          Coming to your dashboard
        </AppText>
        {NEXT[business.serviceType].map(item => (
          <View key={item.title} style={styles.next}>
            <IonIcon name={item.icon} size="lg" color={service.accent} />
            <View style={styles.grow}>
              <AppText variant="bodyStrong">{item.title}</AppText>
              <AppText variant="small" tone="muted">
                {item.body}
              </AppText>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default PartnerHomeScreen;
