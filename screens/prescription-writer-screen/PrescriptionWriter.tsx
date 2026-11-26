// ═══════════════════════════════════════════════════════
// MetroMatrix — Prescription writer
// ═══════════════════════════════════════════════════════
// Diagnosis (your recent ones a tap away), then a row per medicine: the name
// suggests as you type, favourites first; strength, form, the dose pattern
// (1+0+1, 1+1+1, 0+0+1, 1+0+0 or your own), when to take it, for how many
// days; move rows up and down. Tests, advice, follow-up. Preview shows the
// document exactly as the patient (and the PDF) will. Saved, the patient is
// told; it can be changed for 24 hours, and you can share it as a PDF. Every
// limit is the API's own; leaving with unsaved changes asks first.

import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { useDebouncedValue } from '../../hooks/usePagedList';
import { useNow } from '../../hooks/useNow';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
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
  RowCardsSkeleton,
  ScreenShell,
  SectionCard,
  SegmentTabs,
  TextAction,
  TextField,
} from '../../Custom-Components/index';
import {
  DOSE_PRESETS,
  DURATION_PRESETS,
  FOLLOW_UP_PRESETS,
  MAX_ADVICE,
  MAX_DAYS,
  MAX_DIAGNOSIS,
  MAX_INSTRUCTIONS,
  MAX_MEDICINE_NAME,
  MAX_STRENGTH,
  MAX_TEST,
  MEDICINE_FORMS,
  TIMINGS,
  formatDose,
  prescriptionToSave,
  validatePrescription,
} from '../../models/health/prescriptionModel';
import type { DoctorPartnerStackParamList } from '../../models';
import { formatOn, formatWhen } from '../../utils/health-time/healthTime';
import { haptics } from '../../utils/haptics/haptics';
import { prescriptionHtml } from '../../utils/prescription-html/prescriptionHtml';
import { sharePrescriptionPdf } from '../../services/prescriptionPdf';
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

const PrescriptionWriter: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <PrescriptionWriterContent {...props} />
  </ServiceScope>
);

const PrescriptionWriterContent: React.FC<Props> = ({ route }) => {
  const { appointmentId } = route.params;
  const { back } = useBack({ name: 'DoctorAppointment', params: { id: appointmentId } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, motion, service } = useTheme();
  const s = useAppSelector(selectWriter);
  const now = useNow();
  const f = s.form;
  const a = s.appointment;
  const dirty = JSON.stringify(f) !== JSON.stringify(s.saved);
  useUnsavedGuard(dirty && s.status === 'succeeded', s.saveStatus === 'loading');
  const [sharing, setSharing] = React.useState(false);

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
        {s.status === 'failed' ? (
          <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(startWriterAsync(appointmentId)) }} />
        ) : (
          <RowCardsSkeleton count={3} />
        )}
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
    // A saved prescription keeps the day it was written.
    issuedAt: a.prescription?.issuedAt ?? new Date(now).toISOString(),
    ...prescriptionToSave(f),
  };

  /** The saved prescription as a PDF: print it, or send it on (WhatsApp, email). */
  const sharePdf = async () => {
    setSharing(true);
    try {
      const html = prescriptionHtml(doc, { ink: colors.ink, muted: colors.inkMuted, line: colors.line, accent: service.accentDeep });
      const r = await sharePrescriptionPdf(html, `Prescription ${a.patient.name} ${formatOn(doc.issuedAt)}`);
      if (r === 'unavailable') Toast.show({ type: 'info', text1: "This device can't share a PDF", text2: 'The patient has it in their app.' });
    } finally {
      setSharing(false);
    }
  };
  const footerError = s.touched && Object.keys(errors).length ? 'Check the highlighted fields.' : s.error.message;

  return (
    <ScreenShell
      title={locked ? 'Prescription' : s.prescriptionId ? 'Edit prescription' : 'Write a prescription'}
      subtitle={`${a.patient.name}${a.patient.age !== null ? ` · ${a.patient.age} years` : ''} · ${formatWhen(a.startAt, a.timezone)}`}
      onBack={back}
      footer={
        locked ? (
          s.prescriptionId ? <Button label="Share as PDF" leftIcon="share-outline" variant="secondary" onPress={() => void sharePdf()} loading={sharing} fullWidth /> : undefined
        ) : (
          <View style={styles.group}>
            {footerError ? <InlineNotice message={footerError} /> : null}
            <Button
              label={s.prescriptionId ? 'Save changes' : 'Save and send to the patient'}
              onPress={() => void save()}
              loading={s.saveStatus === 'loading'}
              disabled={!!s.prescriptionId && !dirty}
              fullWidth
            />
            {s.prescriptionId && !dirty ? (
              <Button label="Share as PDF" leftIcon="share-outline" variant="ghost" onPress={() => void sharePdf()} loading={sharing} fullWidth />
            ) : null}
          </View>
        )
      }>
      {locked ? (
        <InlineNotice tone="info" title="This prescription is locked" message="Prescriptions can be changed for 24 hours after they are written. Write a new one at the next visit." />
      ) : (
        <SegmentTabs
          options={[
            { key: 'write', label: 'Write' },
            { key: 'preview', label: 'Preview' },
          ]}
          value={s.preview ? 'preview' : 'write'}
          onChange={k => dispatch(setPreview(k === 'preview'))}
          accessibilityLabel="Write or preview"
        />
      )}

      {s.preview || locked ? (
        <PrescriptionSheet prescription={doc} />
      ) : (
        <>
          <SectionCard title="Diagnosis" icon="pulse-outline">
            <TextField
              label="Diagnosis"
              value={f.diagnosis}
              onChangeText={t => dispatch(setDiagnosis(t))}
              error={show('diagnosis')}
              placeholder="Acne vulgaris (moderate)"
              maxLength={MAX_DIAGNOSIS}
            />
            {s.diagnoses.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollChips} keyboardShouldPersistTaps="handled">
                {s.diagnoses.map(d => (
                  <ChoiceChip key={d} label={d} selected={f.diagnosis === d} onPress={() => dispatch(setDiagnosis(d))} />
                ))}
              </ScrollView>
            ) : null}
          </SectionCard>

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
                maxLength={MAX_MEDICINE_NAME}
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
                  <TextField
                    label="Strength"
                    value={m.strength}
                    onChangeText={t => dispatch(setMedicine({ index: i, patch: { strength: t } }))}
                    placeholder="500 mg"
                    maxLength={MAX_STRENGTH}
                    error={show(`medicine.${i}.strength`)}
                  />
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
              <AppText variant="label">Form</AppText>
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
              <TextField
                label="Or your own pattern"
                value={m.dose}
                onChangeText={t => dispatch(setMedicine({ index: i, patch: { dose: t } }))}
                error={show(`medicine.${i}.dose`)}
                placeholder="0.5+0+1 or 2 puffs"
                autoCorrect={false}
                maxLength={20}
              />
              <AppText variant="label">When to take it</AppText>
              {/* One is always chosen: the API needs it (a second tap used to clear it). */}
              <View style={styles.chips}>
                {TIMINGS.map(tm => (
                  <ChoiceChip key={tm.key} label={tm.label} selected={m.timing === tm.key} onPress={() => dispatch(setMedicine({ index: i, patch: { timing: tm.key } }))} />
                ))}
              </View>
              {show(`medicine.${i}.timing`) ? (
                <AppText variant="small" tone="danger">
                  {show(`medicine.${i}.timing`)}
                </AppText>
              ) : null}
              <TextField
                label="Instructions (optional)"
                value={m.instructions ?? ''}
                onChangeText={t => dispatch(setMedicine({ index: i, patch: { instructions: t || null } }))}
                placeholder="With a full glass of water"
                maxLength={MAX_INSTRUCTIONS}
                error={show(`medicine.${i}.instructions`)}
              />
            </Card>
          ))}
          <TextAction label="Add medicine" icon="add" onPress={() => dispatch(addMedicine())} />

          <SectionCard title="Tests" icon="flask-outline">
            <View style={styles.chips}>
              {f.tests.map(t => (
                <ChoiceChip key={t} label={t} icon="close" selected onPress={() => dispatch(removeTest(t))} accessibilityHint="Remove this test" />
              ))}
            </View>
            <View style={styles.add}>
              <View style={styles.grow}>
                <TextField
                  label="Add a test"
                  value={s.newTest}
                  onChangeText={t => dispatch(setNewTest(t))}
                  onSubmitEditing={() => dispatch(addTest())}
                  placeholder="Complete blood count"
                  returnKeyType="done"
                  maxLength={MAX_TEST}
                />
              </View>
              <Button label="Add" size="sm" variant="secondary" onPress={() => dispatch(addTest())} disabled={s.newTest.trim().length < 2} />
            </View>
            {show('tests') ? (
              <AppText variant="small" tone="danger">
                {show('tests')}
              </AppText>
            ) : null}
          </SectionCard>

          <SectionCard title="Advice" icon="chatbubble-ellipses-outline">
            <TextField
              label="Advice"
              value={f.advice ?? ''}
              onChangeText={t => dispatch(setAdvice(t))}
              multiline
              placeholder="Plenty of fluids and rest."
              maxLength={MAX_ADVICE}
              error={show('advice')}
            />
          </SectionCard>

          <SectionCard title="Follow-up" icon="repeat-outline">
            <View style={styles.chips}>
              <ChoiceChip label="None" selected={f.followUpInDays === null} onPress={() => dispatch(setFollowUp(null))} />
              {FOLLOW_UP_PRESETS.map(d => (
                <ChoiceChip key={d} label={`In ${d} days`} selected={f.followUpInDays === d} onPress={() => dispatch(setFollowUp(d))} />
              ))}
            </View>
          </SectionCard>
          <AppText variant="small" tone="muted">
            Saved, the patient is told and can share it as a PDF. You can change it for 24 hours.
          </AppText>
        </>
      )}
    </ScreenShell>
  );
};

export default PrescriptionWriter;
