// ═══════════════════════════════════════════════════════
// MetroMatrix — Your profile (what patients read)
// ═══════════════════════════════════════════════════════
// Photo, title and name, specialty (and a second one), practising since,
// languages, about, qualifications and experience tables, services, the
// conditions you treat, and your booking rules (how far ahead, how much
// notice, the cancellation cutoff, transfer before video).

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import {
  AppText,
  BottomSheetPicker,
  Button,
  Card,
  ChoiceChip,
  DoctorPhoto,
  IconButton,
  InlineNotice,
  ListRow,
  ScreenShell,
  SkeletonLines,
  TextAction,
  TextField,
  ToggleRow,
} from '../../../../Custom-Components/index';
import {
  BOOKING_WINDOW_CHOICES,
  CANCEL_CUTOFF_CHOICES,
  LANGUAGES,
  MAX_ABOUT,
  MIN_NOTICE_CHOICES,
  TITLES,
  emptyExperience,
  emptyQualification,
  minutesLabel,
  validateDoctorProfile,
} from '../../../../models/health/doctorProfileModel';
import type { DoctorPartnerStackParamList, Gender } from '../../../../types';
import { haptics } from '../../../../utils/haptics';
import { pickImageFromLibrary } from '../../../../utils/pickers';
import {
  addService,
  editProfile,
  loadOwnProfileAsync,
  openPicker,
  saveOwnProfileAsync,
  selectProfileEdit,
  setConditionQuery,
  setNewService,
  touchProfile,
  uploadPhotoAsync,
} from './doctorProfileEditSlice';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'DoctorProfileEdit'>;

const GENDERS: { key: Gender; label: string }[] = [
  { key: 'female', label: 'Female' },
  { key: 'male', label: 'Male' },
  { key: 'other', label: 'Other' },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    photo: { flexDirection: 'row', alignItems: 'center', gap: space.s16 },
    group: { gap: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pair: { flexDirection: 'row', gap: space.s8 },
    grow: { flex: 1 },
    add: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s8 },
  });

const DoctorProfileEditScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <DoctorProfileEditContent {...props} />
  </ServiceScope>
);

const DoctorProfileEditContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'DoctorTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectProfileEdit);
  const f = s.form;
  const thisYear = new Date().getFullYear();

  useEffect(() => {
    void dispatch(loadOwnProfileAsync());
  }, [dispatch]);

  if (!f) {
    return (
      <ScreenShell title="Your profile" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadOwnProfileAsync()) }} /> : <SkeletonLines lines={10} />}
      </ScreenShell>
    );
  }

  const errors = validateDoctorProfile(f, thisYear);
  const show = (k: string) => (s.touched ? errors[k] : undefined);
  const specialtyName = (slug: string | null) => s.specialties.find(x => x.slug === slug)?.name ?? 'Choose';
  const q = s.conditionQuery.trim().toLowerCase();
  const conditions = s.conditions.filter(c => (q ? c.name.toLowerCase().includes(q) : c.specialtySlug === f.specialtySlug || f.conditionSlugs.includes(c.slug)));

  const save = async () => {
    dispatch(touchProfile());
    if (Object.keys(errors).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(saveOwnProfileAsync(f));
    if (saveOwnProfileAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Profile saved', text2: f.isListed ? 'Patients see it now.' : undefined });
    } else haptics.warning();
  };

  const pickPhoto = async () => {
    const file = await pickImageFromLibrary({ square: true });
    if (file) void dispatch(uploadPhotoAsync(file));
  };

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  return (
    <ScreenShell
      title="Your profile"
      subtitle={`PMDC ${f.pmdcNumber}`}
      onBack={back}
      footer={<Button label="Save profile" onPress={() => void save()} loading={s.saveStatus === 'loading'} disabled={s.uploading} fullWidth />}>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}

      <View style={styles.photo}>
        <DoctorPhoto name={f.name} uri={f.photoUrl} size="lg" />
        <TextAction label={s.uploading ? 'Uploading…' : f.photoUrl ? 'Change photo' : 'Add a photo'} icon="camera-outline" onPress={() => void pickPhoto()} disabled={s.uploading} />
      </View>

      <View style={styles.group}>
        <AppText variant="label">Title</AppText>
        <View style={styles.chips}>
          {TITLES.map(t => (
            <ChoiceChip key={t} label={t} selected={f.title === t} onPress={() => dispatch(editProfile({ title: t }))} />
          ))}
        </View>
      </View>
      <TextField label="Full name" value={f.name} onChangeText={t => dispatch(editProfile({ name: t }))} error={show('name')} autoCapitalize="words" />
      <View style={styles.group}>
        <AppText variant="label">Gender</AppText>
        <View style={styles.chips}>
          {GENDERS.map(g => (
            <ChoiceChip key={g.key} label={g.label} selected={f.gender === g.key} onPress={() => dispatch(editProfile({ gender: g.key }))} />
          ))}
        </View>
      </View>

      <Card padded="horizontal">
        <ListRow title="Specialty" value={specialtyName(f.specialtySlug)} onPress={() => dispatch(openPicker('specialty'))} chevron />
        <ListRow title="Second specialty (optional)" value={f.secondarySpecialtySlug ? specialtyName(f.secondarySpecialtySlug) : 'None'} onPress={() => dispatch(openPicker('secondary'))} chevron />
      </Card>
      {show('specialtySlug') ? <AppText variant="small" tone="danger">{show('specialtySlug')}</AppText> : null}

      <TextField
        label="Practising since (year)"
        value={f.practisingSince ? String(f.practisingSince) : ''}
        onChangeText={t => dispatch(editProfile({ practisingSince: t.trim() ? Number(t.replace(/\D/g, '')) || null : null }))}
        keyboardType="number-pad"
        maxLength={4}
        error={show('practisingSince')}
        placeholder="2012"
      />

      <View style={styles.group}>
        <AppText variant="label">Languages you consult in</AppText>
        <View style={styles.chips}>
          {LANGUAGES.map(l => (
            <ChoiceChip key={l} label={l} selected={f.languages.includes(l)} onPress={() => dispatch(editProfile({ languages: toggle(f.languages, l) }))} />
          ))}
        </View>
        {show('languages') ? <AppText variant="small" tone="danger">{show('languages')}</AppText> : null}
      </View>

      <TextField label="About you" value={f.about} onChangeText={t => dispatch(editProfile({ about: t }))} multiline maxLength={MAX_ABOUT} error={show('about')} helper="What you treat, how you work, and where you trained. At least two or three lines." />

      <View style={styles.group}>
        <View style={styles.rowHead}>
          <AppText variant="title">Qualifications</AppText>
          <TextAction label="Add" icon="add" onPress={() => dispatch(editProfile({ qualifications: [...f.qualifications, emptyQualification()] }))} />
        </View>
        {f.qualifications.map((q2, i) => (
          <Card key={`q-${i}`}>
            <View style={styles.rowHead}>
              <AppText variant="small" tone="muted">{`Qualification ${i + 1}`}</AppText>
              <IconButton icon="close" tone="muted" onPress={() => dispatch(editProfile({ qualifications: f.qualifications.filter((_, k) => k !== i) }))} accessibilityLabel={`Remove qualification ${i + 1}`} />
            </View>
            <TextField label="Degree" value={q2.degree} onChangeText={t => dispatch(editProfile({ qualifications: f.qualifications.map((x, k) => (k === i ? { ...x, degree: t } : x)) }))} error={show(`qualification.${i}.degree`)} placeholder="FCPS (Dermatology)" />
            <View style={styles.pair}>
              <View style={styles.grow}>
                <TextField label="Institute" value={q2.institute} onChangeText={t => dispatch(editProfile({ qualifications: f.qualifications.map((x, k) => (k === i ? { ...x, institute: t } : x)) }))} />
              </View>
              <View style={styles.grow}>
                <TextField
                  label="Year"
                  value={q2.year ? String(q2.year) : ''}
                  onChangeText={t => dispatch(editProfile({ qualifications: f.qualifications.map((x, k) => (k === i ? { ...x, year: Number(t.replace(/\D/g, '')) || null } : x)) }))}
                  keyboardType="number-pad"
                  maxLength={4}
                  error={show(`qualification.${i}.year`)}
                />
              </View>
            </View>
          </Card>
        ))}
      </View>

      <View style={styles.group}>
        <View style={styles.rowHead}>
          <AppText variant="title">Experience</AppText>
          <TextAction label="Add" icon="add" onPress={() => dispatch(editProfile({ experience: [...f.experience, emptyExperience()] }))} />
        </View>
        {f.experience.map((e, i) => (
          <Card key={`e-${i}`}>
            <View style={styles.rowHead}>
              <AppText variant="small" tone="muted">{`Position ${i + 1}`}</AppText>
              <IconButton icon="close" tone="muted" onPress={() => dispatch(editProfile({ experience: f.experience.filter((_, k) => k !== i) }))} accessibilityLabel={`Remove position ${i + 1}`} />
            </View>
            <TextField label="Role" value={e.role} onChangeText={t => dispatch(editProfile({ experience: f.experience.map((x, k) => (k === i ? { ...x, role: t } : x)) }))} error={show(`experience.${i}.role`)} placeholder="Consultant dermatologist" />
            <TextField label="Hospital or clinic" value={e.place} onChangeText={t => dispatch(editProfile({ experience: f.experience.map((x, k) => (k === i ? { ...x, place: t } : x)) }))} />
            <View style={styles.pair}>
              <View style={styles.grow}>
                <TextField label="From (year)" value={e.from ? String(e.from) : ''} onChangeText={t => dispatch(editProfile({ experience: f.experience.map((x, k) => (k === i ? { ...x, from: Number(t.replace(/\D/g, '')) || null } : x)) }))} keyboardType="number-pad" maxLength={4} />
              </View>
              <View style={styles.grow}>
                <TextField
                  label="To (blank = now)"
                  value={e.to ? String(e.to) : ''}
                  onChangeText={t => dispatch(editProfile({ experience: f.experience.map((x, k) => (k === i ? { ...x, to: Number(t.replace(/\D/g, '')) || null } : x)) }))}
                  keyboardType="number-pad"
                  maxLength={4}
                  error={show(`experience.${i}.to`)}
                />
              </View>
            </View>
          </Card>
        ))}
      </View>

      <View style={styles.group}>
        <AppText variant="title">Services</AppText>
        <View style={styles.chips}>
          {f.services.map(sv => (
            <ChoiceChip key={sv} label={sv} icon="close" selected onPress={() => dispatch(editProfile({ services: f.services.filter(x => x !== sv) }))} accessibilityHint="Remove this service" />
          ))}
        </View>
        <View style={styles.add}>
          <View style={styles.grow}>
            <TextField label="Add a service" value={s.newService} onChangeText={t => dispatch(setNewService(t))} onSubmitEditing={() => dispatch(addService())} placeholder="Acne treatment" returnKeyType="done" />
          </View>
          <Button label="Add" size="sm" variant="secondary" onPress={() => dispatch(addService())} disabled={!s.newService.trim()} />
        </View>
      </View>

      <View style={styles.group}>
        <AppText variant="title">Conditions you treat</AppText>
        <TextField label="Find a condition" value={s.conditionQuery} onChangeText={t => dispatch(setConditionQuery(t))} icon="search" clearable placeholder="Acne, diabetes…" />
        <View style={styles.chips}>
          {conditions.map(c => (
            <ChoiceChip key={c.slug} label={c.name} selected={f.conditionSlugs.includes(c.slug)} onPress={() => dispatch(editProfile({ conditionSlugs: toggle(f.conditionSlugs, c.slug) }))} />
          ))}
        </View>
      </View>

      <Card>
        <AppText variant="title">Booking rules</AppText>
        <AppText variant="label">Patients can book up to</AppText>
        <View style={styles.chips}>
          {BOOKING_WINDOW_CHOICES.map(d => (
            <ChoiceChip key={d} label={`${d} days ahead`} selected={f.bookingRules.windowDays === d} onPress={() => dispatch(editProfile({ bookingRules: { ...f.bookingRules, windowDays: d } }))} />
          ))}
        </View>
        <AppText variant="label">Shortest notice</AppText>
        <View style={styles.chips}>
          {MIN_NOTICE_CHOICES.map(m => (
            <ChoiceChip key={m} label={minutesLabel(m)} selected={f.bookingRules.minNoticeMinutes === m} onPress={() => dispatch(editProfile({ bookingRules: { ...f.bookingRules, minNoticeMinutes: m } }))} />
          ))}
        </View>
        <AppText variant="label">Late cancellation if within</AppText>
        <View style={styles.chips}>
          {CANCEL_CUTOFF_CHOICES.map(hrs => (
            <ChoiceChip key={hrs} label={`${hrs} h`} selected={f.bookingRules.cancelCutoffHours === hrs} onPress={() => dispatch(editProfile({ bookingRules: { ...f.bookingRules, cancelCutoffHours: hrs } }))} />
          ))}
        </View>
        <ToggleRow
          label="Ask for payment before video consultations"
          helper="Patients transfer the fee to your account before the call."
          value={f.bookingRules.videoPrepay}
          onChange={v => dispatch(editProfile({ bookingRules: { ...f.bookingRules, videoPrepay: v } }))}
        />
      </Card>

      <BottomSheetPicker
        visible={s.picker !== null}
        onClose={() => dispatch(openPicker(null))}
        title={s.picker === 'secondary' ? 'Second specialty' : 'Your specialty'}
        options={[...(s.picker === 'secondary' ? [{ value: '', label: 'None' }] : []), ...s.specialties.map(sp => ({ value: sp.slug, label: sp.name }))]}
        value={(s.picker === 'secondary' ? f.secondarySpecialtySlug : f.specialtySlug) ?? ''}
        onSelect={v => {
          dispatch(editProfile(s.picker === 'secondary' ? { secondarySpecialtySlug: v || null } : { specialtySlug: v || null }));
          dispatch(openPicker(null));
        }}
      />
    </ScreenShell>
  );
};

export default DoctorProfileEditScreen;
