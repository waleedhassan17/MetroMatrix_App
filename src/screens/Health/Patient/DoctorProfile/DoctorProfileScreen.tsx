// ═══════════════════════════════════════════════════════
// MetroMatrix — Doctor profile (booking lives here)
// ═══════════════════════════════════════════════════════
// One scroll. Who the doctor is (verified, specialty in English and Urdu,
// qualifications, experience, languages), measured stats, then "Choose how
// to see the doctor" — video and each clinic as rows with their own fee and
// next free time — and that row's days and times right under it. Tap a
// time, tap "Book …", confirm in the sheet: three taps. Then about,
// services, conditions treated, qualifications, experience, reviews and
// similar doctors.

import React, { useEffect } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useHealthNav } from '@hooks/useHealth';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  ConditionChip,
  DateStrip,
  Divider,
  DoctorBadges,
  DoctorCard,
  DoctorPhoto,
  DoctorReviewItem,
  IconButton,
  InlineNotice,
  LocationRow,
  ReviewSummary,
  ScreenShell,
  Skeleton,
  SkeletonLines,
  SlotGrid,
  StatTrio,
  TextAction,
} from '@custom/index';
import { HealthSection } from '@components/health/HealthParts';
import type { DoctorProfile, HomeStackParamList, PracticeLocation } from '@/types';
import { formatWhen } from '@utils/healthTime';
import { formatPKR } from '@utils/money';
import { newUuid } from '@utils/ids';
import { haptics } from '@utils/haptics';
import { BookAppointmentSheet } from '../BookAppointment/BookAppointmentSheet';
import { openBooking } from '../BookAppointment/bookAppointmentSlice';
import {
  chooseDayAsync,
  chooseLocationAsync,
  closeProfileView,
  loadDoctorAsync,
  openProfileView,
  pickSlot,
  selectDoctorEntry,
  selectProfileView,
  toggleAbout,
} from './doctorProfileSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'DoctorProfile'>;

const makeStyles = ({ colors, space, radius, gutter }: Theme) =>
  StyleSheet.create({
    hero: { flexDirection: 'row', gap: space.s16 },
    heroText: { flex: 1, gap: space.s4 },
    ur: { writingDirection: 'rtl' },
    block: { gap: space.s12 },
    bleed: { marginHorizontal: -gutter },
    railContent: { paddingHorizontal: gutter, gap: space.s12 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    tag: { paddingHorizontal: space.s12, paddingVertical: space.s4, borderRadius: radius.pill, backgroundColor: colors.surfaceSunk },
    table: { gap: space.s0 },
    tableRow: { flexDirection: 'row', gap: space.s12, paddingVertical: space.s12 },
    tableMain: { flex: 1, gap: space.s0 },
  });

/** Where the patient came from picks the row; else the soonest free one. */
const initialLocation = (profile: DoctorProfile, params: Props['route']['params']): PracticeLocation | null => {
  const locs = profile.locations;
  return (
    locs.find(l => l.id === params.locationId) ??
    (params.kind ? locs.find(l => l.kind === params.kind) : undefined) ??
    [...locs].sort((a, b) => (a.availability.nextAt ?? '9').localeCompare(b.availability.nextAt ?? '9'))[0] ??
    null
  );
};

const DoctorProfileScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <DoctorProfileContent {...props} />
  </ServiceScope>
);

const DoctorProfileContent: React.FC<Props> = ({ route, navigation }) => {
  const { back } = useBack({ name: 'HealthHome' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const nav = useHealthNav();
  const key = route.key;
  const id = route.params.id;
  const entry = useAppSelector(st => selectDoctorEntry(st, id));
  const view = useAppSelector(st => selectProfileView(st, key));
  const d = entry.profile;

  useEffect(() => {
    dispatch(openProfileView({ key, doctorId: id }));
    void dispatch(loadDoctorAsync(id));
    return () => {
      dispatch(closeProfileView(key));
    };
  }, [dispatch, key, id]);

  // Once the profile is here, choose the row and load its times.
  useEffect(() => {
    if (!d || !view || view.locationId) return;
    const loc = initialLocation(d, route.params);
    if (loc) void dispatch(chooseLocationAsync({ key, doctorId: d.id, locationId: loc.id }));
  }, [d, view, key, route.params, dispatch]);

  const location = d?.locations.find(l => l.id === view?.locationId) ?? null;

  const share = async () => {
    if (!d) return;
    const link = `metromatrix://health/doctor/${d.id}`;
    const message = `${d.name}, ${d.specialty.name} on MetroMatrix: ${link}`;
    try {
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(link);
      Toast.show({ type: 'success', text1: 'Link copied' });
    }
  };

  const book = () => {
    if (!d || !location || !view?.selected) return;
    haptics.press();
    dispatch(openBooking({ viewKey: key, doctorId: d.id, doctorName: d.name, location, startAt: view.selected, idempotencyKey: newUuid() }));
  };

  const cta = view?.selected && location ? `Book ${formatWhen(view.selected, location.timezone)} · ${formatPKR(location.fee)}` : 'Select a time';

  return (
    <ScreenShell
      title={d?.name ?? route.params.name ?? 'Doctor'}
      subtitle={d ? d.specialty.name : undefined}
      onBack={back}
      headerRight={d ? <IconButton icon="share-social-outline" onPress={() => void share()} accessibilityLabel="Share this doctor" /> : undefined}
      footer={d ? <Button label={cta} onPress={book} disabled={!view?.selected} fullWidth accessibilityHint="Opens the confirmation" /> : undefined}
      refreshing={entry.status === 'loading' && !!d}
      onRefresh={() => void dispatch(loadDoctorAsync(id))}>
      {entry.status === 'failed' && !d ? <InlineNotice message={entry.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadDoctorAsync(id)) }} /> : null}
      {!d ? (
        entry.status === 'failed' ? null : (
          <>
            <View style={styles.hero}>
              <Skeleton width={size.doctorPhoto.lg} height={size.doctorPhoto.lg} shape="lg" />
              <View style={styles.heroText}>
                <SkeletonLines lines={4} />
              </View>
            </View>
            <Skeleton height={size.doctorPhoto.lg} shape="md" />
            <SkeletonLines lines={6} />
          </>
        )
      ) : (
        <>
          <View style={styles.hero}>
            <DoctorPhoto name={d.name} uri={d.photoUrl} size="lg" />
            <View style={styles.heroText}>
              <DoctorBadges badges={d.badges} />
              <AppText variant="bodyStrong">{d.specialty.name}</AppText>
              {d.specialty.nameUr ? (
                <AppText variant="small" tone="muted" style={styles.ur}>
                  {d.specialty.nameUr}
                </AppText>
              ) : null}
              {d.qualifications ? <AppText variant="small">{d.qualifications}</AppText> : null}
              <AppText variant="small" tone="muted">
                {[d.yearsExperience ? `${d.yearsExperience} years experience` : null, d.languages.length ? `Speaks ${d.languages.join(', ')}` : null].filter(Boolean).join(' · ')}
              </AppText>
            </View>
          </View>

          <StatTrio stats={d.stats} />

          <View style={styles.block}>
            <HealthSection title="Choose how to see the doctor" />
            {d.locations.length ? (
              d.locations.map(l => (
                <LocationRow
                  key={l.id}
                  location={l}
                  selected={l.id === view?.locationId}
                  onSelect={() => l.id !== view?.locationId && void dispatch(chooseLocationAsync({ key, doctorId: d.id, locationId: l.id }))}
                />
              ))
            ) : (
              <AppText variant="body" tone="muted">
                This doctor isn’t taking appointments right now.
              </AppText>
            )}
          </View>

          {location && view ? (
            <View style={styles.block}>
              <HealthSection title="Choose a time" subtitle={location.kind === 'video' ? 'Video consultation' : location.name} />
              <View style={styles.bleed}>
                <DateStrip
                  days={view.days}
                  selected={view.date}
                  loading={view.loading && !view.days.length}
                  onSelect={date => void dispatch(chooseDayAsync({ key, doctorId: d.id, locationId: location.id, date }))}
                />
              </View>
              {view.error.message ? <InlineNotice message={view.error.message} /> : null}
              <SlotGrid
                slots={view.day?.slots ?? []}
                timezone={view.day?.timezone ?? location.timezone}
                selected={view.selected}
                loading={view.loading}
                onSelect={startAt => {
                  haptics.select();
                  dispatch(pickSlot({ key, startAt: view.selected === startAt ? null : startAt }));
                }}
                nextAvailable={view.day?.nextAvailable ?? null}
                onNextAvailable={date => void dispatch(chooseDayAsync({ key, doctorId: d.id, locationId: location.id, date }))}
              />
            </View>
          ) : null}

          {d.about ? (
            <View style={styles.block}>
              <HealthSection title="About" />
              <AppText variant="body" numberOfLines={view?.aboutOpen ? undefined : 4}>
                {d.about}
              </AppText>
              {d.about.length > 180 ? <TextAction label={view?.aboutOpen ? 'Show less' : 'Read more'} onPress={() => dispatch(toggleAbout(key))} /> : null}
            </View>
          ) : null}

          {d.services.length ? (
            <View style={styles.block}>
              <HealthSection title="Services" />
              <View style={styles.tags}>
                {d.services.map(s => (
                  <View key={s} style={styles.tag}>
                    <AppText variant="small">{s}</AppText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {d.conditions.length ? (
            <View style={styles.block}>
              <HealthSection title="Conditions treated" />
              <View style={styles.tags}>
                {d.conditions.map(c => (
                  <ConditionChip key={c.slug} condition={{ name: c.name, nameUr: null }} onPress={() => nav.openDoctors({ condition: c.slug, title: `Doctors who treat ${c.name}` })} />
                ))}
              </View>
            </View>
          ) : null}

          {d.qualificationList.length ? (
            <View style={styles.block}>
              <HealthSection title="Qualifications" />
              <View style={styles.table}>
                {d.qualificationList.map((q, i) => (
                  <View key={`${q.degree}-${i}`}>
                    {i > 0 ? <Divider /> : null}
                    <View style={styles.tableRow}>
                      <View style={styles.tableMain}>
                        <AppText variant="bodyStrong">{q.degree}</AppText>
                        <AppText variant="small" tone="muted">
                          {q.institute}
                        </AppText>
                      </View>
                      {q.year ? <AppText variant="small" tone="muted">{String(q.year)}</AppText> : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {d.experienceList.length ? (
            <View style={styles.block}>
              <HealthSection title="Experience" />
              <View style={styles.table}>
                {d.experienceList.map((e, i) => (
                  <View key={`${e.role}-${i}`}>
                    {i > 0 ? <Divider /> : null}
                    <View style={styles.tableRow}>
                      <View style={styles.tableMain}>
                        <AppText variant="bodyStrong">{e.role}</AppText>
                        <AppText variant="small" tone="muted">
                          {e.place}
                        </AppText>
                      </View>
                      <AppText variant="small" tone="muted">
                        {e.from ? `${e.from} – ${e.to ?? 'now'}` : ''}
                      </AppText>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.block}>
            <HealthSection title="Patient reviews" onSeeAll={d.reviewSummary.count ? () => navigation.navigate('DoctorReviews', { doctorId: d.id, name: d.name }) : undefined} seeAllLabel="All reviews" />
            <ReviewSummary summary={d.reviewSummary} />
            {d.topReviews.map(r => (
              <View key={r.id}>
                <Divider />
                <DoctorReviewItem review={r} doctorName={d.name} />
              </View>
            ))}
          </View>

          {d.similar.length ? (
            <View style={styles.block}>
              <HealthSection title="Similar doctors" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.railContent}>
                {d.similar.map(o => (
                  <DoctorCard key={o.id} doctor={o} compact onPress={() => nav.openDoctor(o.id, { name: o.name })} />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </>
      )}
      <BookAppointmentSheet />
    </ScreenShell>
  );
};

export default DoctorProfileScreen;
