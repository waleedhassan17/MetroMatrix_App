// ═══════════════════════════════════════════════════════
// PrescriptionSheet — the prescription as a document
// ═══════════════════════════════════════════════════════
// Doctor header (name, qualifications, PMDC, where), the patient line,
// diagnosis, a row per medicine with its morning / afternoon / night dots,
// timing and duration, tests, advice and follow-up. The PDF is built from
// the same layout (utils/prescription-html/prescriptionHtml), so what you share is what you see.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { Prescription, PrescriptionInput } from '../../models/health';
import { doseSlots, formLabel, formatDose, timingLabel } from '../../models/health/prescriptionModel';
import { formatOn } from '../../utils/health-time/healthTime';
import { AppText } from '../AppText';
import { Divider } from '../Divider';

export type PrescriptionDoc = Pick<Prescription, 'doctor' | 'patient' | 'issuedAt'> & PrescriptionInput;

const makeStyles = ({ colors, space, radius, size }: Theme) =>
  StyleSheet.create({
    root: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: size.border, borderColor: colors.line, padding: space.s16, gap: space.s16 },
    head: { gap: space.s4 },
    patient: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space.s8 },
    section: { gap: space.s8 },
    med: { gap: space.s4, paddingVertical: space.s8, borderBottomWidth: size.hairline, borderBottomColor: colors.lineSoft },
    medTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.s12 },
    medName: { flex: 1 },
    dots: { flexDirection: 'row', gap: space.s12 },
    dotCell: { alignItems: 'center', gap: space.s4 },
    dot: { width: size.doseDot, height: size.doseDot, borderRadius: radius.pill, borderWidth: size.border },
  });

const DoseDots: React.FC<{ dose: string }> = ({ dose }) => {
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  return (
    <View style={styles.dots} accessible accessibilityLabel={`Dose ${formatDose(dose)}: ${doseSlots(dose).map(s => `${s.label} ${s.amount}`).join(', ')}`}>
      {doseSlots(dose).map(s => (
        <View key={s.label} style={styles.dotCell}>
          <View style={[styles.dot, { borderColor: s.amount ? service.accent : colors.lineStrong, backgroundColor: s.amount ? service.accent : colors.surface }]} />
          <AppText variant="micro" tone="muted">
            {s.label[0]}
          </AppText>
        </View>
      ))}
    </View>
  );
};

export const PrescriptionSheet: React.FC<{ prescription: PrescriptionDoc }> = ({ prescription: p }) => {
  const styles = useStyles(makeStyles);
  const patient = [p.patient.name, p.patient.age !== null ? `${p.patient.age} years` : null, p.patient.gender ? p.patient.gender[0].toUpperCase() + p.patient.gender.slice(1) : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <AppText variant="h2">{p.doctor.name}</AppText>
        <AppText variant="small">{[p.doctor.qualifications, p.doctor.specialtyName].filter(Boolean).join(' · ')}</AppText>
        <AppText variant="caption" tone="muted">
          {[p.doctor.pmdcNumber ? `PMDC ${p.doctor.pmdcNumber}` : null, p.doctor.place, p.doctor.phone].filter(Boolean).join(' · ')}
        </AppText>
      </View>
      <Divider />
      <View style={styles.patient}>
        <AppText variant="bodyStrong">{patient}</AppText>
        <AppText variant="small" tone="muted">
          {formatOn(p.issuedAt)}
        </AppText>
      </View>
      {p.diagnosis ? (
        <View style={styles.section}>
          <AppText variant="micro" tone="muted">
            DIAGNOSIS
          </AppText>
          <AppText variant="body">{p.diagnosis}</AppText>
        </View>
      ) : null}
      {p.medicines.length ? (
        <View style={styles.section}>
          <AppText variant="micro" tone="muted">
            MEDICINES
          </AppText>
          {p.medicines.map((m, i) => (
            <View key={`${m.name}-${i}`} style={styles.med}>
              <View style={styles.medTop}>
                <View style={styles.medName}>
                  <AppText variant="bodyStrong">{`${i + 1}. ${m.name} ${m.strength}`.trim()}</AppText>
                  <AppText variant="caption" tone="muted">
                    {[formLabel(m.form), formatDose(m.dose), timingLabel(m.timing), `${m.days} ${m.days === 1 ? 'day' : 'days'}`].filter(Boolean).join(' · ')}
                  </AppText>
                </View>
                <DoseDots dose={m.dose} />
              </View>
              {m.instructions ? (
                <AppText variant="small" tone="muted">
                  {m.instructions}
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      {p.tests.length ? (
        <View style={styles.section}>
          <AppText variant="micro" tone="muted">
            TESTS
          </AppText>
          {p.tests.map(t => (
            <AppText key={t} variant="body">{`• ${t}`}</AppText>
          ))}
        </View>
      ) : null}
      {p.advice ? (
        <View style={styles.section}>
          <AppText variant="micro" tone="muted">
            ADVICE
          </AppText>
          <AppText variant="body">{p.advice}</AppText>
        </View>
      ) : null}
      {p.followUpInDays ? (
        <AppText variant="bodyStrong">{`Follow-up in ${p.followUpInDays} ${p.followUpInDays === 1 ? 'day' : 'days'}`}</AppText>
      ) : null}
    </View>
  );
};

export default PrescriptionSheet;
