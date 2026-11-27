// ═══════════════════════════════════════════════════════
// MetroMatrix — Your profile (what patients read)
// ═══════════════════════════════════════════════════════
// In section cards: your photo (round, with a camera badge) and name; your
// practice (specialty and up to five more, practising since, languages);
// about; qualifications and experience; services; the conditions you treat;
// and your booking rules. Every limit is the API's own, every error shows
// under its field (the server's too), and leaving with unsaved changes asks
// first. A failed save says so next to the Save button, where you are.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import {
  AppText,
  Avatar,
  BottomSheetPicker,
  Button,
  Card,
  ChoiceChip,
  Divider,
  IconButton,
  InlineNotice,
  ListRow,
  RowCardsSkeleton,
  ScreenShell,
  SectionCard,
  TextAction,
  TextField,
  ToggleRow,
} from '../../Custom-Components/index';
import {
  BOOKING_WINDOW_CHOICES,
  CANCEL_CUTOFF_CHOICES,
  LANGUAGES,
  MAX_ABOUT,
  MAX_CONDITIONS,
  MAX_DEGREE,
  MAX_EXPERIENCE,
  MAX_INSTITUTE,
  MAX_NAME,
  MAX_QUALIFICATIONS,
  MAX_ROLE,
  MAX_SECONDARY_SPECIALTIES,
  MAX_SERVICE,
  MIN_ABOUT,
  MIN_NOTICE_CHOICES,
  TITLES,
  emptyExperience,
  emptyQualification,
  minutesLabel,
  validateDoctorProfile,
} from '../../models/health/doctorProfileModel';
import type { DoctorPartnerStackParamList, Gender } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { pickImageFromLibrary } from '../../utils/pickers/pickers';
import {
  addLanguage,
  addService,
  editProfile,
  loadOwnProfileAsync,
  openPicker,
  saveOwnProfileAsync,
  selectProfileEdit,
  setConditionQuery,
  setNewLanguage,
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
    photo: { alignItems: 'center', gap: space.s8 },
    group: { gap: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pair: { flexDirection: 'row', gap: space.s8 },
    grow: { flex: 1 },
    add: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s8 },
    footer: { gap: space.s8 },
  });

const DoctorProfileEdit: React.FC<Props> = props => (
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
  const dirty = !!f && !!s.saved && JSON.stringify(f) !== JSON.stringify(s.saved);
  useUnsavedGuard(dirty, s.saveStatus === 'loading');

  useEffect(() => {
    void dispatch(loadOwnProfileAsync());
  }, [dispatch]);

  if (!f) {
    return (
      <ScreenShell title="Your profile" onBack={back}>
        {s.status === 'failed' ? (
          <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadOwnProfileAsync()) }} />
        ) : (
          <RowCardsSkeleton count={5} />
        )}
      </ScreenShell>
    );
  }

  const errors = validateDoctorProfile(f, thisYear);
  // The server's word on a field shows until it's edited; ours once Save was tried.
  const show = (k: string) => s.serverErrors[k] ?? (s.touched ? errors[k] : undefined);
  const specialtyName = (slug: string | null) => s.specialties.find(x => x.slug === slug)?.name ?? 'Choose';
  const q = s.conditionQuery.trim().toLowerCase();
  const conditions = s.conditions.filter(c =>
    q ? c.name.toLowerCase().includes(q) : c.specialtySlug === f.specialtySlug || f.conditionSlugs.includes(c.slug),
  );
  const languages = [...LANGUAGES, ...f.languages.filter(l => !LANGUAGES.includes(l))];
  const errorCount = Object.keys(errors).length;

  const save = async () => {
    dispatch(touchProfile());
    if (errorCount) {
      haptics.warning();
      return;
    }
    const r = await dispatch(saveOwnProfileAsync({ form: f, saved: s.saved }));
    if (saveOwnProfileAsync.fulfilled.match(r)) {
      haptics.success();
      // What the server says now, not what the form thought before saving.
      Toast.show({
        type: 'success',
        text1: 'Profile saved',
        text2: r.payload.isListed ? 'Patients see it now.' : 'Finish your practice setup so patients can find you.',
      });
    } else haptics.warning();
  };

  const pickPhoto = async () => {
    const file = await pickImageFromLibrary({ square: true });
    if (file) void dispatch(uploadPhotoAsync(file));
  };

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  const footerError = s.touched && errorCount ? 'Check the highlighted fields.' : s.error.message;

  return (
    <ScreenShell
      title="Your profile"
      subtitle={f.pmdcNumber ? `PMDC ${f.pmdcNumber}` : undefined}
      onBack={back}
      footer={
        <View style={styles.footer}>
          {footerError ? <InlineNotice message={footerError} /> : null}
          <Button label="Save profile" onPress={() => void save()} loading={s.saveStatus === 'loading'} disabled={s.uploading} fullWidth />
        </View>
      }>
      <SectionCard title="Photo and name" icon="person-outline">
        <View style={styles.photo}>
          <Avatar
            name={f.name}
            uri={f.photoUrl}
            size="xl"
            editable
            uploading={s.uploading}
            onPress={() => void pickPhoto()}
          />
          <AppText variant="caption" tone="muted" align="center">
            {s.uploading ? 'Uploading your photo…' : 'A clear, recent photo of you. Patients see it first.'}
          </AppText>
        </View>
        <View style={styles.group}>
          <AppText variant="label">Title</AppText>
          <View style={styles.chips}>
            {TITLES.map(t => (
              <ChoiceChip key={t} label={t} selected={f.title === t} onPress={() => dispatch(editProfile({ title: t }))} />
            ))}
          </View>
        </View>
        <TextField
          label="Full name"
          value={f.name}
          onChangeText={t => dispatch(editProfile({ name: t }))}
          error={show('name')}
          autoCapitalize="words"
          maxLength={MAX_NAME}
        />
        <View style={styles.group}>
          <AppText variant="label">Gender</AppText>
          <View style={styles.chips}>
            {GENDERS.map(g => (
              <ChoiceChip key={g.key} label={g.label} selected={f.gender === g.key} onPress={() => dispatch(editProfile({ gender: g.key }))} />
            ))}
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Your practice" icon="medkit-outline">
        <Card padded="horizontal" elevation="none">
          <ListRow title="Specialty" value={specialtyName(f.specialtySlug)} onPress={() => dispatch(openPicker('specialty'))} chevron />
        </Card>
        {show('specialtySlug') ? (
          <AppText variant="small" tone="danger">
            {show('specialtySlug')}
          </AppText>
        ) : null}
        <View style={styles.group}>
          <AppText variant="label">{`More specialties (optional, up to ${MAX_SECONDARY_SPECIALTIES})`}</AppText>
          <View style={styles.chips}>
            {f.secondarySpecialtySlugs.map(slug => (
              <ChoiceChip
                key={slug}
                label={specialtyName(slug)}
                icon="close"
                selected
                onPress={() => dispatch(editProfile({ secondarySpecialtySlugs: f.secondarySpecialtySlugs.filter(x => x !== slug) }))}
                accessibilityHint="Remove this specialty"
              />
            ))}
            {f.secondarySpecialtySlugs.length < MAX_SECONDARY_SPECIALTIES ? (
              <ChoiceChip label="Add a specialty" icon="add" selected={false} onPress={() => dispatch(openPicker('secondary'))} />
            ) : null}
          </View>
          {show('secondarySpecialtySlugs') ? (
            <AppText variant="small" tone="danger">
              {show('secondarySpecialtySlugs')}
            </AppText>
          ) : null}
        </View>
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
            {languages.map(l => (
              <ChoiceChip key={l} label={l} selected={f.languages.includes(l)} onPress={() => dispatch(editProfile({ languages: toggle(f.languages, l) }))} />
            ))}
          </View>
          <View style={styles.add}>
            <View style={styles.grow}>
              <TextField
                label="Add another language"
                value={s.newLanguage}
                onChangeText={t => dispatch(setNewLanguage(t))}
                onSubmitEditing={() => dispatch(addLanguage())}
                placeholder="Gujarati"
                maxLength={30}
                returnKeyType="done"
              />
            </View>
            <Button label="Add" size="sm" variant="secondary" onPress={() => dispatch(addLanguage())} disabled={s.newLanguage.trim().length < 2} />
          </View>
          {show('languages') ? (
            <AppText variant="small" tone="danger">
              {show('languages')}
            </AppText>
          ) : null}
        </View>
      </SectionCard>

      <SectionCard title="About you" icon="document-text-outline" subtitle="Patients read this first on your profile.">
        <TextField
          label="About you"
          value={f.about}
          onChangeText={t => dispatch(editProfile({ about: t }))}
          multiline
          maxLength={MAX_ABOUT}
          error={show('about')}
          helper={`What you treat, how you work, and where you trained. At least ${MIN_ABOUT} characters (${f.about.trim().length} so far).`}
        />
      </SectionCard>

      <SectionCard
        title="Qualifications"
        icon="school-outline"
        action={
          f.qualifications.length < MAX_QUALIFICATIONS
            ? { label: 'Add', onPress: () => dispatch(editProfile({ qualifications: [...f.qualifications, emptyQualification()] })) }
            : undefined
        }>
        {f.qualifications.length === 0 ? (
          <AppText variant="small" tone="muted">
            Add your degrees and where you trained.
          </AppText>
        ) : null}
        {f.qualifications.map((q2, i) => (
          <View key={`q-${i}`} style={styles.group}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.rowHead}>
              <AppText variant="small" tone="muted">{`Qualification ${i + 1}`}</AppText>
              <IconButton
                icon="close"
                tone="muted"
                onPress={() => dispatch(editProfile({ qualifications: f.qualifications.filter((_, k) => k !== i) }))}
                accessibilityLabel={`Remove qualification ${i + 1}`}
              />
            </View>
            <TextField
              label="Degree"
              value={q2.degree}
              onChangeText={t => dispatch(editProfile({ qualifications: f.qualifications.map((x, k) => (k === i ? { ...x, degree: t } : x)) }))}
              error={show(`qualification.${i}.degree`)}
              placeholder="FCPS (Dermatology)"
              maxLength={MAX_DEGREE}
            />
            <View style={styles.pair}>
              <View style={styles.grow}>
                <TextField
                  label="Institute"
                  value={q2.institute}
                  onChangeText={t => dispatch(editProfile({ qualifications: f.qualifications.map((x, k) => (k === i ? { ...x, institute: t } : x)) }))}
                  error={show(`qualification.${i}.institute`)}
                  maxLength={MAX_INSTITUTE}
                />
              </View>
              <View style={styles.grow}>
                <TextField
                  label="Year"
                  value={q2.year ? String(q2.year) : ''}
                  onChangeText={t =>
                    dispatch(editProfile({ qualifications: f.qualifications.map((x, k) => (k === i ? { ...x, year: Number(t.replace(/\D/g, '')) || null } : x)) }))
                  }
                  keyboardType="number-pad"
                  maxLength={4}
                  error={show(`qualification.${i}.year`)}
                />
              </View>
            </View>
          </View>
        ))}
      </SectionCard>

      <SectionCard
        title="Experience"
        icon="briefcase-outline"
        action={
          f.experience.length < MAX_EXPERIENCE
            ? { label: 'Add', onPress: () => dispatch(editProfile({ experience: [...f.experience, emptyExperience()] })) }
            : undefined
        }>
        {f.experience.length === 0 ? (
          <AppText variant="small" tone="muted">
            Where you have worked, and since when.
          </AppText>
        ) : null}
        {f.experience.map((e, i) => (
          <View key={`e-${i}`} style={styles.group}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.rowHead}>
              <AppText variant="small" tone="muted">{`Position ${i + 1}`}</AppText>
              <IconButton
                icon="close"
                tone="muted"
                onPress={() => dispatch(editProfile({ experience: f.experience.filter((_, k) => k !== i) }))}
                accessibilityLabel={`Remove position ${i + 1}`}
              />
            </View>
            <TextField
              label="Role"
              value={e.role}
              onChangeText={t => dispatch(editProfile({ experience: f.experience.map((x, k) => (k === i ? { ...x, role: t } : x)) }))}
              error={show(`experience.${i}.role`)}
              placeholder="Consultant dermatologist"
              maxLength={MAX_ROLE}
            />
            <TextField
              label="Hospital or clinic"
              value={e.place}
              onChangeText={t => dispatch(editProfile({ experience: f.experience.map((x, k) => (k === i ? { ...x, place: t } : x)) }))}
              maxLength={MAX_INSTITUTE}
            />
            <View style={styles.pair}>
              <View style={styles.grow}>
                <TextField
                  label="From (year)"
                  value={e.from ? String(e.from) : ''}
                  onChangeText={t =>
                    dispatch(editProfile({ experience: f.experience.map((x, k) => (k === i ? { ...x, from: Number(t.replace(/\D/g, '')) || null } : x)) }))
                  }
                  keyboardType="number-pad"
                  maxLength={4}
                  error={show(`experience.${i}.from`)}
                />
              </View>
              <View style={styles.grow}>
                <TextField
                  label="Until (year)"
                  helper="Leave blank if you still work here"
                  value={e.to ? String(e.to) : ''}
                  onChangeText={t =>
                    dispatch(editProfile({ experience: f.experience.map((x, k) => (k === i ? { ...x, to: Number(t.replace(/\D/g, '')) || null } : x)) }))
                  }
                  keyboardType="number-pad"
                  maxLength={4}
                  error={show(`experience.${i}.to`)}
                />
              </View>
            </View>
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Services" icon="list-outline" subtitle="What patients can come to you for.">
        {f.services.length ? (
          <View style={styles.chips}>
            {f.services.map(sv => (
              <ChoiceChip
                key={sv}
                label={sv}
                icon="close"
                selected
                onPress={() => dispatch(editProfile({ services: f.services.filter(x => x !== sv) }))}
                accessibilityHint="Remove this service"
              />
            ))}
          </View>
        ) : null}
        <View style={styles.add}>
          <View style={styles.grow}>
            <TextField
              label="Add a service"
              value={s.newService}
              onChangeText={t => dispatch(setNewService(t))}
              onSubmitEditing={() => dispatch(addService())}
              placeholder="Acne treatment"
              returnKeyType="done"
              maxLength={MAX_SERVICE}
            />
          </View>
          <Button label="Add" size="sm" variant="secondary" onPress={() => dispatch(addService())} disabled={s.newService.trim().length < 2} />
        </View>
        {show('services') ? (
          <AppText variant="small" tone="danger">
            {show('services')}
          </AppText>
        ) : null}
      </SectionCard>

      <SectionCard title="Conditions you treat" icon="pulse-outline" subtitle={`Up to ${MAX_CONDITIONS}. Patients searching for one can find you.`}>
        <TextField
          label="Find a condition"
          value={s.conditionQuery}
          onChangeText={t => dispatch(setConditionQuery(t))}
          icon="search"
          clearable
          placeholder="Acne, diabetes…"
        />
        {conditions.length ? (
          <View style={styles.chips}>
            {conditions.map(c => (
              <ChoiceChip
                key={c.slug}
                label={c.name}
                selected={f.conditionSlugs.includes(c.slug)}
                onPress={() => dispatch(editProfile({ conditionSlugs: toggle(f.conditionSlugs, c.slug) }))}
              />
            ))}
          </View>
        ) : (
          <AppText variant="small" tone="muted">
            {f.specialtySlug ? 'Search above to find a condition.' : 'Choose your specialty first, or search above.'}
          </AppText>
        )}
        {show('conditions') ? (
          <AppText variant="small" tone="danger">
            {show('conditions')}
          </AppText>
        ) : null}
      </SectionCard>

      <SectionCard title="Booking rules" icon="time-outline">
        <AppText variant="label">Patients can book up to</AppText>
        <View style={styles.chips}>
          {BOOKING_WINDOW_CHOICES.map(d => (
            <ChoiceChip
              key={d}
              label={`${d} days ahead`}
              selected={f.bookingRules.windowDays === d}
              onPress={() => dispatch(editProfile({ bookingRules: { ...f.bookingRules, windowDays: d } }))}
            />
          ))}
        </View>
        <AppText variant="label">Shortest notice</AppText>
        <View style={styles.chips}>
          {MIN_NOTICE_CHOICES.map(m => (
            <ChoiceChip
              key={m}
              label={minutesLabel(m)}
              selected={f.bookingRules.minNoticeMinutes === m}
              onPress={() => dispatch(editProfile({ bookingRules: { ...f.bookingRules, minNoticeMinutes: m } }))}
            />
          ))}
        </View>
        <AppText variant="label">Late cancellation if within</AppText>
        <View style={styles.chips}>
          {CANCEL_CUTOFF_CHOICES.map(hrs => (
            <ChoiceChip
              key={hrs}
              label={`${hrs} h`}
              selected={f.bookingRules.cancelCutoffHours === hrs}
              onPress={() => dispatch(editProfile({ bookingRules: { ...f.bookingRules, cancelCutoffHours: hrs } }))}
            />
          ))}
        </View>
        <ToggleRow
          label="Ask for payment before video consultations"
          helper="Patients transfer the fee to your payment account before the call. Needs an active payment account."
          value={f.bookingRules.videoPrepay}
          onChange={v => dispatch(editProfile({ bookingRules: { ...f.bookingRules, videoPrepay: v } }))}
        />
      </SectionCard>

      {dirty ? <TextAction label="Undo my changes" icon="arrow-undo-outline" tone="muted" onPress={() => s.saved && dispatch(editProfile(s.saved))} /> : null}

      <BottomSheetPicker
        visible={s.picker !== null}
        onClose={() => dispatch(openPicker(null))}
        title={s.picker === 'secondary' ? 'Add a specialty' : 'Your specialty'}
        options={s.specialties
          .filter(sp => (s.picker === 'secondary' ? sp.slug !== f.specialtySlug && !f.secondarySpecialtySlugs.includes(sp.slug) : true))
          .map(sp => ({ value: sp.slug, label: sp.name }))}
        value={s.picker === 'secondary' ? '' : (f.specialtySlug ?? '')}
        onSelect={v => {
          if (s.picker === 'secondary') {
            if (v) dispatch(editProfile({ secondarySpecialtySlugs: [...f.secondarySpecialtySlugs, v] }));
          } else {
            // A specialty chosen as the main one leaves the extra ones.
            dispatch(editProfile({ specialtySlug: v || null, secondarySpecialtySlugs: f.secondarySpecialtySlugs.filter(x => x !== v) }));
          }
          dispatch(openPicker(null));
        }}
      />
    </ScreenShell>
  );
};

export default DoctorProfileEdit;
