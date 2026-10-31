// ═══════════════════════════════════════════════════════
// MetroMatrix — Health home (the Digital Health card)
// ═══════════════════════════════════════════════════════
// Photo-led, top to bottom: search, then "how can we help you today?" (the
// two ways to be seen, and who is free today); the next visit and its one
// action; Health's own services as photo tiles; staff promotions; the
// specialty grid; the city's top doctors; doctors free today; the concerns
// patients name; why MetroMatrix Health; and, quietly last, the emergency
// numbers. Every photo is relevant and licensed (CREDITS.md).

import React, { useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useServiceNav } from '../../hooks/useServiceNav';
import { useHealthNav } from '../../hooks/useHealth';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  BottomSheetPicker,
  CareCard,
  ConcernTile,
  DoctorCard,
  DoctorSpotlightCard,
  EmergencyBanner,
  InlineNotice,
  NextVisitCard,
  PhotoBannerCarousel,
  PhotoTile,
  ScreenShell,
  Skeleton,
  SpecialtyTile,
  TextAction,
  type IonName,
} from '../../Custom-Components/index';
import { SearchPill } from '../../Components/shopping/ShopParts';
import { HealthSection, QuickRow, TrustList, bannerCta, useAppointmentAction } from '../../Components/health/HealthParts';
import { HEALTH_PHOTOS } from '../../Components/health/healthPhotos';
import { concernIcon, homeSpecialties } from '../../models/health/homeModel';
import type { HomeStackParamList } from '../../models';
import { selectUser } from '../../store/authSlice';
import { loadHealthHomeAsync, selectHealthHome, setCityPicker } from './healthHomeSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'HealthHome'>;

const SEARCH_HINTS = ['Search doctors', 'Search specialties', 'Search conditions like fever'];

const makeStyles = ({ space, gutter, size, radius, colors, elevation }: Theme) =>
  StyleSheet.create({
    page: { gap: space.s32 },
    block: { gap: space.s12 },
    bento: { flexDirection: 'row', gap: space.s12 },
    bentoColumn: { flex: 1, gap: space.s12 },
    rail: { marginHorizontal: -gutter },
    railContent: { paddingHorizontal: gutter, gap: space.s12, paddingBottom: space.s4 },
    concerns: { paddingHorizontal: gutter, gap: space.s8 },
    grid: { padding: space.s12, gap: space.s4, borderRadius: radius.lg, backgroundColor: colors.surface, ...elevation.card },
    gridRow: { flexDirection: 'row', gap: space.s4 },
    railSkeleton: { flexDirection: 'row', gap: space.s12 },
    spotlightSkeleton: { width: size.spotlightCard },
    railCardSkeleton: { width: size.doctorRailCard },
  });

const HealthHome: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <HealthHomeContent {...props} />
  </ServiceScope>
);

const HealthHomeContent: React.FC<Props> = ({ navigation }) => {
  // The service's Home tab: back leaves the service for the three cards.
  const { leaveService: back } = useServiceNav();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { specialtyTint } = useTheme();
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
  const grid = homeSpecialties(specialties);
  const tintAt = (i: number) => specialtyTint[i % specialtyTint.length];

  const tiles: { key: string; label: string; image: (typeof HEALTH_PHOTOS)[keyof typeof HEALTH_PHOTOS]; onPress: () => void; tone?: 'danger' }[] = [
    { key: 'specialties', label: 'Specialties', image: HEALTH_PHOTOS.specialties, onPress: () => navigation.navigate('SpecialtyList') },
    { key: 'records', label: 'Health records', image: HEALTH_PHOTOS.records, onPress: nav.openRecords },
    { key: 'prescriptions', label: 'Prescriptions', image: HEALTH_PHOTOS.prescriptions, onPress: () => navigation.navigate('PrescriptionList') },
    { key: 'family', label: 'Family', image: HEALTH_PHOTOS.family, onPress: () => navigation.navigate('FamilyMembers') },
    { key: 'symptoms', label: 'Symptom checker', image: HEALTH_PHOTOS.symptoms, onPress: () => navigation.navigate('SymptomChecker') },
    { key: 'emergency', label: 'Emergency', image: HEALTH_PHOTOS.emergency, tone: 'danger', onPress: () => navigation.navigate('Emergency') },
  ];

  return (
    <ScreenShell
      title="Digital Health"
      subtitle={first ? `Hi ${first}, how can we help you today?` : 'How can we help you today?'}
      onBack={back}
      headerScrolls
      headerRight={<TextAction label={city} icon="location-outline" onPress={() => dispatch(setCityPicker(true))} accessibilityLabel={`City: ${city}. Change`} />}
      headerContent={<SearchPill label="Search doctors, specialties and conditions" hints={SEARCH_HINTS} onPress={nav.openSearch} />}
      refreshing={s.refreshing}
      onRefresh={() => load(true)}>
      <View style={styles.page}>
        {s.status === 'failed' && !home ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => load() }} /> : null}

        <View style={styles.bento}>
          <View style={styles.bentoColumn}>
            <CareCard
              tall
              tint="video"
              title="Video consultation"
              body="See a doctor from home"
              image={HEALTH_PHOTOS.video}
              onPress={() => nav.openDoctors({ kind: 'video', title: 'Video consultation' })}
            />
          </View>
          <View style={styles.bentoColumn}>
            <CareCard
              tint="clinic"
              title="Clinic visit"
              body="Book a confirmed time"
              image={HEALTH_PHOTOS.clinic}
              onPress={() => nav.openDoctors({ kind: 'clinic', title: 'Clinic visit' })}
            />
            <CareCard
              tint="today"
              title="Available today"
              body="Doctors free now"
              image={HEALTH_PHOTOS.available}
              onPress={() => nav.openDoctors({ availableToday: true, title: 'Available today' })}
            />
          </View>
        </View>

        {!home ? (
          <Skeleton height={64} shape="lg" />
        ) : home.upcoming ? (
          <View style={styles.block}>
            <HealthSection title="Your next visit" onSeeAll={() => nav.openAppointments()} seeAllLabel="All appointments" />
            <NextVisitCard appointment={home.upcoming} onPress={() => nav.openAppointment(home.upcoming!.code)} action={actionFor(home.upcoming)} />
          </View>
        ) : (
          <QuickRow icon="calendar-outline" title="My appointments" body="Upcoming and past visits" onPress={() => nav.openAppointments()} />
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.railContent}>
          {tiles.map(t => (
            <PhotoTile key={t.key} label={t.label} image={t.image} tone={t.tone} onPress={t.onPress} />
          ))}
        </ScrollView>

        {home?.banners.length ? <PhotoBannerCarousel banners={home.banners} onOpen={nav.openBanner} cta={bannerCta} bleed /> : null}

        <View style={styles.block}>
          <HealthSection title="Find by specialty" onSeeAll={() => navigation.navigate('SpecialtyList')} />
          {!home ? (
            <Skeleton height={232} shape="lg" />
          ) : (
            <View style={styles.grid}>
              {[grid.slice(0, 4), grid.slice(4, 8)].map((row, r) => (
                <View key={r} style={styles.gridRow}>
                  {row.map((sp, i) => (
                    <SpecialtyTile key={sp.slug} specialty={sp} bare tint={tintAt(r * 4 + i)} onPress={() => nav.openDoctors({ specialty: sp.slug, title: sp.name })} />
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>

        {!home || home.featuredDoctors.length ? (
          <View style={styles.block}>
            <HealthSection
              title={home?.featuredScope === 'nationwide' ? 'Top doctors across Pakistan' : `Top doctors in ${city}`}
              subtitle="Well rated, with times open soon"
            />
            {!home ? (
              <View style={styles.railSkeleton}>
                <View style={styles.spotlightSkeleton}>
                  <Skeleton height={164} shape="lg" />
                </View>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.railContent}>
                {home.featuredDoctors.map(d => (
                  <DoctorSpotlightCard
                    key={d.id}
                    doctor={d}
                    onPress={() => nav.openDoctor(d.id, { name: d.name })}
                    onBook={() => nav.openDoctor(d.id, { name: d.name, kind: d.offersClinic ? 'clinic' : 'video' })}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        <View style={styles.block}>
          <HealthSection title={`Available today in ${city}`} onSeeAll={() => nav.openDoctors({ availableToday: true, title: 'Available today' })} />
          {!home ? (
            <View style={styles.railSkeleton}>
              <View style={styles.railCardSkeleton}>
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

        {home?.commonConditions.length ? (
          <View style={styles.block}>
            <HealthSection
              title="Common concerns"
              subtitle="Not sure of the specialty? Start with what you feel."
              onSeeAll={() => navigation.navigate('ConditionList')}
              seeAllLabel="All conditions"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.concerns}>
              {home.commonConditions.map((c, i) => (
                <ConcernTile
                  key={c.slug}
                  name={c.name}
                  icon={concernIcon(c, specialties) as IonName}
                  tint={tintAt(i + 3)}
                  onPress={() => nav.openDoctors({ condition: c.slug, title: `Doctors who treat ${c.name}` })}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <TrustList />

        <EmergencyBanner variant="quiet" numbers={home?.emergencyNumbers ?? []} onOpen={() => navigation.navigate('Emergency')} />
      </View>

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

export default HealthHome;
