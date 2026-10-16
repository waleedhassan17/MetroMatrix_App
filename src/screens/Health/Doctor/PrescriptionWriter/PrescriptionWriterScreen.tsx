// ═══════════════════════════════════════════════════════
// MetroMatrix — Prescription writer
// ═══════════════════════════════════════════════════════
// Diagnosis (your recent ones a tap away), then a row per medicine: the name
// suggests as you type, favourites first; strength, form, the dose pattern
// (1+0+1, 1+1+1, 0+0+1, 1+0+0 or your own), when to take it, for how many
// days; move rows up and down. Tests, advice, follow-up. Preview shows the
// document exactly as the patient (and the PDF) will. Saved, the patient is
// told; it can be changed for 24 hours.

import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useDebouncedValue } from '@hooks/usePagedList';
import { useNow } from '@hooks/useNow';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  Card,
  ChoiceChip,
  IconButton,
  InlineNotice,
  IonIcon,
  PrescriptionSheet,
  QuantityStepper,
  ScreenShell,
  SegmentTabs,
  SkeletonLines,
  TextAction,
  TextField,
} from '@custom/index';
import {
  DOSE_PRESETS,
  DURATION_PRESETS,
  FOLLOW_UP_PRESETS,
  MAX_DAYS,
  MEDICINE_FORMS,
  TIMINGS,
  formatDose,
  prescriptionToSave,
  validatePrescription,
} from '@models/health/prescriptionModel';
import type { DoctorPartnerStackParamList } from '@/types';
import { formatWhen } from '@utils/healthTime';
import { haptics } from '@utils/haptics';
import {
  addMedicine,
  addTest,
  clearSuggestions,
  moveMedicineRow,
  pickSuggestion,
  removeMedicine,
  removeTest,
  savePrescriptionAsync,
  selectWriter,
  setAdvice,
  setDiagnosis,
  setFollowUp,
  setMedicine,
  setNewTest,
  setPreview,
  startWriterAsync,
  suggestMedicineAsync,
  touchPrescription,
} from './prescriptionWriterSlice';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'PrescriptionWriter'>;

const makeStyles = ({ colors, space, radius, size }: Theme) =>
  StyleSheet.create({
    group: { gap: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    scrollChips: { gap: space.s8 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headActions: { flexDirection: 'row', alignItems: 'center' },
    pair: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s12 },
    grow: { flex: 1 },
    suggest: { borderRadius: radius.md, borderWidth: size.border, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' },
    suggestRow: { flexDirection: 'row', alignItems: 'center', gap: space.s8, minHeight: size.touch, paddingHorizontal: space.s12 },
    add: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s8 },
  });

const PrescriptionWriterScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <PrescriptionWriterContent {...props} />
  </ServiceScope>
);

const PrescriptionWriterContent: React.FC<Props> = ({ route }) => {
  const { appointmentId } = route.params;
  const { back } = useBack({ name: 'DoctorAppointment', params: { id: appointmentId } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, motion } = useTheme();
  const s = useAppSelector(selectWriter);
  const now = useNow();
  const f = s.form;
  const a = s.appointment;

  useEffect(() => {
    void dispatch(startWriterAsync(appointmentId));
  }, [dispatch, appointmentId]);

  // Suggest for the row being typed in (after a short pause).
  const typing = s.suggestions?.row ?? -1;
  const lastEdited = f.medicines.map(m => m.name.trim()).join('|');
  const settled = useDebouncedValue(lastEdited, motion.suggestDebounce);
  const [focusRow, setFocusRow] = React.useState<number | null>(null);
  useEffect(() => {
    if (focusRow === null) return;
    const q = f.medicines[focusRow]?.name.trim() ?? '';
    if (q.length >= 1) void dispatch(suggestMedicineAsync({ row: focusRow, q }));
    else dispatch(clearSuggestions());
    // Only when the typed names settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, focusRow, dispatch]);

  const locked = !!s.prescriptionId && !!s.editableUntil && Date.parse(s.editableUntil) < now;
  const errors = validatePrescription(f);
  const show = (k: string) => (s.touched ? errors[k] : undefined);

  const save = async () => {
    dispatch(touchPrescription());
    if (Object.keys(errors).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(savePrescriptionAsync({ appointmentId, prescriptionId: s.prescriptionId, input: prescriptionToSave(f) }));
    if (savePrescriptionAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: s.prescriptionId ? 'Prescription updated' : 'Prescription sent', text2: 'The patient can see it now.' });
      back();
    } else haptics.warning();
  };

  if (!a) {
    return (
      <ScreenShell title="Prescription" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} /> : <SkeletonLines lines={10} />}
      </ScreenShell>
    );
  }

  const doc = {
    doctor: {
      name: s.profile ? `${s.profile.title} ${s.profile.name}`.trim() : 'Doctor',
      specialtyName: s.profile?.specialtyName ?? '',
      qualifications: s.profile?.qualifications.map(q => q.degree).join(', ') ?? '',
      pmdcNumber: s.profile?.pmdcNumber ?? '',
      place: a.kind === 'video' ? 'Video consultation' : [a.location.name, a.location.area, a.location.city].filter(Boolean).join(', '),
      phone: a.location.phone,
    },
    patient: { name: a.patient.name, age: a.patient.age, gender: a.patient.gender },
    issuedAt: new Date(now).toISOString(),
    ...prescriptionToSave(f),
  };

  return (
    <ScreenShell
      title={s.prescriptionId ? 'Edit prescription' : 'Prescription'}
      subtitle={`${a.patient.name}${a.patient.age !== null ? ` · ${a.patient.age} years` : ''} · ${formatWhen(a.startAt, a.timezone)}`}
      onBack={back}
      footer={locked ? undefined : <Button label={s.prescriptionId ? 'Save changes' : 'Save and send to the patient'} onPress={() => void save()} loading={s.saveStatus === 'loading'} fullWidth />}>
      {locked ? <InlineNotice tone="info" title="This prescription is locked" message="Prescriptions can be changed for 24 hours after they are written. Write a new one at the next visit." /> : null}
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      <SegmentTabs
        options={[
          { key: 'write', label: 'Write' },
          { key: 'preview', label: 'Preview' },
        ]}
        value={s.preview || locked ? 'preview' : 'write'}
        onChange={k => dispatch(setPreview(k === 'preview'))}
        accessibilityLabel="Write or preview"
      />

      {s.preview || locked ? (
        <PrescriptionSheet prescription={doc} />
      ) : (
        <>
          <View style={styles.group}>
            <TextField label="Diagnosis" value={f.diagnosis} onChangeText={t => dispatch(setDiagnosis(t))} error={show('diagnosis')} placeholder="Acne vulgaris (moderate)" />
            {s.diagnoses.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollChips} keyboardShouldPersistTaps="handled">
                {s.diagnoses.map(d => (
                  <ChoiceChip key={d} label={d} selected={f.diagnosis === d} onPress={() => dispatch(setDiagnosis(d))} />
                ))}
              </ScrollView>
            ) : null}
          </View>

          {show('medicines') ? <InlineNotice message={show('medicines')!} /> : null}
          {f.medicines.map((m, i) => (
            <Card key={i}>
              <View style={styles.head}>
                <AppText variant="title">{`Medicine ${i + 1}`}</AppText>
                <View style={styles.headActions}>
                  <IconButton icon="arrow-up" tone="muted" onPress={() => dispatch(moveMedicineRow({ from: i, to: i - 1 }))} disabled={i === 0} accessibilityLabel={`Move medicine ${i + 1} up`} />
                  <IconButton icon="arrow-down" tone="muted" onPress={() => dispatch(moveMedicineRow({ from: i, to: i + 1 }))} disabled={i === f.medicines.length - 1} accessibilityLabel={`Move medicine ${i + 1} down`} />
                  <IconButton icon="close" tone="muted" onPress={() => dispatch(removeMedicine(i))} accessibilityLabel={`Remove medicine ${i + 1}`} />
                </View>
              </View>
              <TextField
                label="Medicine"
                value={m.name}
                onChangeText={t => {
                  setFocusRow(i);
                  dispatch(setMedicine({ index: i, patch: { name: t } }));
                }}
                onFocus={() => setFocusRow(i)}
                error={show(`medicine.${i}.name`)}
                placeholder="Start typing: para…"
                autoCorrect={false}
              />
              {typing === i && s.suggestions?.items.length ? (
                <View style={styles.suggest}>
                  {s.suggestions.items.slice(0, 6).map(sg => (
                    <Pressable
                      key={`${sg.name}-${sg.strength}`}
                      onPress={() => dispatch(pickSuggestion({ index: i, s: sg }))}
                      style={styles.suggestRow}
                      accessibilityRole="button"
                      accessibilityLabel={`${sg.name} ${sg.strength}${sg.isFavourite ? ', favourite' : ''}`}>
                      <IonIcon name={sg.isFavourite ? 'star' : 'medkit-outline'} size="sm" color={sg.isFavourite ? colors.star : colors.inkMuted} />
                      <AppText variant="body" style={styles.grow}>{`${sg.name} ${sg.strength}`}</AppText>
                      <AppText variant="caption" tone="muted">
                        {MEDICINE_FORMS.find(x => x.key === sg.form)?.label}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={styles.pair}>
                <View style={styles.grow}>
                  <TextField label="Strength" value={m.strength} onChangeText={t => dispatch(setMedicine({ index: i, patch: { strength: t } }))} placeholder="500 mg" />
                </View>
                <View style={styles.group}>
                  <AppText variant="label">Days</AppText>
                  <QuantityStepper value={m.days} onChange={n => dispatch(setMedicine({ index: i, patch: { days: n } }))} min={1} max={MAX_DAYS} label={`Days for medicine ${i + 1}`} />
                </View>
              </View>
              {show(`medicine.${i}.days`) ? <AppText variant="small" tone="danger">{show(`medicine.${i}.days`)}</AppText> : null}
              <View style={styles.chips}>
                {DURATION_PRESETS.map(d => (
                  <ChoiceChip key={d} label={`${d} days`} selected={m.days === d} onPress={() => dispatch(setMedicine({ index: i, patch: { days: d } }))} />
                ))}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollChips}>
                {MEDICINE_FORMS.map(fm => (
                  <ChoiceChip key={fm.key} label={fm.label} selected={m.form === fm.key} onPress={() => dispatch(setMedicine({ index: i, patch: { form: fm.key } }))} />
                ))}
              </ScrollView>
              <AppText variant="label">Dose (morning + afternoon + night)</AppText>
              <View style={styles.chips}>
                {DOSE_PRESETS.map(d => (
                  <ChoiceChip key={d} label={formatDose(d)} selected={m.dose === d} onPress={() => dispatch(setMedicine({ index: i, patch: { dose: d } }))} />
                ))}
              </View>
              <TextField label="Or your own pattern" value={m.dose} onChangeText={t => dispatch(setMedicine({ index: i, patch: { dose: t } }))} error={show(`medicine.${i}.dose`)} placeholder="0.5+0+1" autoCorrect={false} />
              <View style={styles.chips}>
                {TIMINGS.map(tm => (
                  <ChoiceChip key={tm.key} label={tm.label} selected={m.timing === tm.key} onPress={() => dispatch(setMedicine({ index: i, patch: { timing: m.timing === tm.key ? null : tm.key } }))} />
                ))}
              </View>
              <TextField label="Instructions (optional)" value={m.instructions ?? ''} onChangeText={t => dispatch(setMedicine({ index: i, patch: { instructions: t || null } }))} placeholder="With a full glass of water" />
            </Card>
          ))}
          <TextAction label="Add medicine" icon="add" onPress={() => dispatch(addMedicine())} />

          <View style={styles.group}>
            <AppText variant="title">Tests</AppText>
            <View style={styles.chips}>
              {f.tests.map(t => (
                <ChoiceChip key={t} label={t} icon="close" selected onPress={() => dispatch(removeTest(t))} accessibilityHint="Remove this test" />
              ))}
            </View>
            <View style={styles.add}>
              <View style={styles.grow}>
                <TextField label="Add a test" value={s.newTest} onChangeText={t => dispatch(setNewTest(t))} onSubmitEditing={() => dispatch(addTest())} placeholder="Complete blood count" returnKeyType="done" />
              </View>
              <Button label="Add" size="sm" variant="secondary" onPress={() => dispatch(addTest())} disabled={!s.newTest.trim()} />
            </View>
          </View>

          <TextField label="Advice" value={f.advice ?? ''} onChangeText={t => dispatch(setAdvice(t))} multiline placeholder="Plenty of fluids and rest." />

          <View style={styles.group}>
            <AppText variant="title">Follow-up</AppText>
            <View style={styles.chips}>
              <ChoiceChip label="None" selected={f.followUpInDays === null} onPress={() => dispatch(setFollowUp(null))} />
              {FOLLOW_UP_PRESETS.map(d => (
                <ChoiceChip key={d} label={`In ${d} days`} selected={f.followUpInDays === d} onPress={() => dispatch(setFollowUp(d))} />
              ))}
            </View>
          </View>
          <AppText variant="small" tone="muted">
            Saved, the patient is told and can share it as a PDF. You can change it for 24 hours.
          </AppText>
        </>
      )}
    </ScreenShell>
  );
};

export default PrescriptionWriterScreen;
