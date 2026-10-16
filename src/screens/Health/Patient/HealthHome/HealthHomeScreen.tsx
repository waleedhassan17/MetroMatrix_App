// ═══════════════════════════════════════════════════════
// MetroMatrix — Health home (the Digital Health card)
// ═══════════════════════════════════════════════════════
// Search first ("Doctors, specialties, conditions"); then the two ways to be
// seen (video from home, or a confirmed clinic time); the next appointment
// with its one action; specialties; the concerns patients name; doctors free
// today in your city; the symptom checker; and, quietly at the bottom, the
// emergency numbers.

import React, { useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useServiceNav } from '@hooks/useServiceNav';
import { useHealthNav } from '@hooks/useHealth';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import {
  AppText,
  AppointmentCard,
  BottomSheetPicker,
  ConditionChip,
  DoctorCard,
  EmergencyBanner,
  InlineNotice,
  ScreenShell,
  Skeleton,
  SkeletonLines,
  SpecialtyTile,
  TextAction,
} from '@custom/index';
import { SearchPill } from '@components/shopping/ShopParts';
import { ActionTile, HealthSection, PromptRow, useAppointmentAction } from '@components/health/HealthParts';
import type { HomeStackParamList } from '@/types';
import { selectUser } from '../../../Auth/authSlice';
import { loadHealthHomeAsync, selectHealthHome, setCityPicker } from './healthHomeSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'HealthHome'>;

const makeStyles = ({ space, gutter, size }: Theme) =>
  StyleSheet.create({
    tiles: { flexDirection: 'row', gap: space.s12 },
    block: { gap: space.s12 },
    grid: { gap: space.s8 },
    gridRow: { flexDirection: 'row', gap: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    rail: { marginHorizontal: -gutter },
    railContent: { paddingHorizontal: gutter, gap: space.s12 },
    railSkeleton: { flexDirection: 'row', gap: space.s12 },
    skeletonCard: { width: size.doctorRailCard },
  });

const HealthHomeScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <HealthHomeContent {...props} />
  </ServiceScope>
);

const HealthHomeContent: React.FC<Props> = ({ navigation }) => {
  // The service's Home tab: back leaves the service for the three cards.
  const { leaveService: back } = useServiceNav();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectHealthHome);
  const user = useAppSelector(selectUser);
  const nav = useHealthNav();
  const actionFor = useAppointmentAction();
  const home = s.home;

  const load = useCallback((refresh = false, city = s.city) => void dispatch(loadHealthHomeAsync({ city, refresh })), [dispatch, s.city]);
  useEffect(() => {
    if (s.status === 'idle') load();
  }, [s.status, load]);

  const first = user?.name?.split(' ')[0];
  const city = home?.city ?? s.city ?? 'Lahore';
  const specialties = home?.specialties ?? [];

  return (
    <ScreenShell
      title="Digital Health"
      subtitle={first ? `Hi ${first}. See a doctor in a few taps.` : 'See a doctor in a few taps.'}
      onBack={back}
      headerRight={<TextAction label={city} icon="location-outline" onPress={() => dispatch(setCityPicker(true))} accessibilityLabel={`City: ${city}. Change`} />}
      headerContent={<SearchPill label="Doctors, specialties, conditions" onPress={nav.openSearch} />}
      refreshing={s.refreshing}
      onRefresh={() => load(true)}>
      {s.status === 'failed' && !home ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => load() }} /> : null}

      <View style={styles.tiles}>
        <ActionTile icon="videocam-outline" title="Video consultation" body="See a doctor from home" onPress={() => nav.openDoctors({ kind: 'video', title: 'Video consultation' })} />
        <ActionTile icon="business-outline" title="Clinic visit" body="Book a confirmed time" onPress={() => nav.openDoctors({ kind: 'clinic', title: 'Clinic visit' })} />
      </View>

      {home?.upcoming ? (
        <View style={styles.block}>
          <HealthSection title="Your next appointment" onSeeAll={() => nav.openAppointments()} seeAllLabel="All appointments" />
          <AppointmentCard appointment={home.upcoming} onPress={() => nav.openAppointment(home.upcoming!.code)} action={actionFor(home.upcoming)} />
        </View>
      ) : null}

      <View style={styles.block}>
        <HealthSection title="Find by specialty" />
        {!home ? (
          <SkeletonLines lines={4} />
        ) : (
          <View style={styles.grid}>
            {[specialties.slice(0, 3), specialties.slice(3, 6), specialties.slice(6, 8)].map((row, i) => (
              <View key={i} style={styles.gridRow}>
                {row.map(sp => (
                  <SpecialtyTile key={sp.slug} specialty={sp} onPress={() => nav.openDoctors({ specialty: sp.slug, title: sp.name })} />
                ))}
                {i === 2 ? (
                  <SpecialtyTile
                    specialty={{ id: 'all', slug: 'all', name: 'All specialties', icon: 'grid-outline', doctorCount: 0 }}
                    showCount={false}
                    onPress={() => navigation.navigate('SpecialtyList')}
                  />
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      {home?.commonConditions.length ? (
        <View style={styles.block}>
          <HealthSection title="Common concerns" subtitle="Not sure of the specialty? Start with what you feel." onSeeAll={() => navigation.navigate('ConditionList')} seeAllLabel="All conditions" />
          <View style={styles.chips}>
            {home.commonConditions.map(c => (
              <ConditionChip key={c.slug} condition={c} onPress={() => nav.openDoctors({ condition: c.slug, title: `Doctors who treat ${c.name}` })} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.block}>
        <HealthSection title={`Available today in ${city}`} onSeeAll={() => nav.openDoctors({ availableToday: true, title: 'Available today' })} />
        {!home ? (
          <View style={styles.railSkeleton}>
            <View style={styles.skeletonCard}>
              <Skeleton height={140} shape="lg" />
            </View>
          </View>
        ) : home.availableToday.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.railContent}>
            {home.availableToday.map(d => (
              <DoctorCard key={d.id} doctor={d} compact onPress={() => nav.openDoctor(d.id, { name: d.name })} />
            ))}
          </ScrollView>
        ) : (
          <AppText variant="body" tone="muted">
            No doctor has time left today. Tomorrow’s times are open on each profile.
          </AppText>
        )}
      </View>

      <PromptRow icon="help-buoy-outline" title="Not sure who to see?" body="Describe how you feel and we'll suggest the right specialty." onPress={() => navigation.navigate('SymptomChecker')} />

      <EmergencyBanner variant="quiet" numbers={home?.emergencyNumbers ?? []} onOpen={() => navigation.navigate('Emergency')} />

      <BottomSheetPicker
        visible={s.cityPicker}
        onClose={() => dispatch(setCityPicker(false))}
        title="Choose your city"
        options={(home?.cities.length ? home.cities : [city]).map(c => ({ value: c, label: c }))}
        value={city}
        onSelect={c => load(false, c)}
      />
    </ScreenShell>
  );
};

export default HealthHomeScreen;
