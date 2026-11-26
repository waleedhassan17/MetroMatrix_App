// ═══════════════════════════════════════════════════════
// MetroMatrix — A patient's history with you
// ═══════════════════════════════════════════════════════
// Every booking with you, newest first, each with ONE status pill: diagnosis,
// why they came, the prescription. Only completed visits count as seen; only
// your own visits — never other doctors'.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Card, EmptyState, IonIcon, InlineNotice, RowCardsSkeleton, ScreenShell, StatusPill } from '../../Custom-Components/index';
import { APPOINTMENT_STATUS, KIND_LABEL } from '../../models/health/appointmentStatusModel';
import type { DoctorPartnerStackParamList } from '../../models';
import { formatOn } from '../../utils/health-time/healthTime';
import { genderLabel } from '../../models/health/familyMemberModel';
import { loadPatientHistoryAsync, selectPatientHistory } from './patientHistorySlice';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'PatientHistory'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: space.s12, alignItems: 'flex-start' },
    grow: { flex: 1, gap: space.s4 },
    pill: { alignSelf: 'flex-start' },
  });

const PatientHistory: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <PatientHistoryContent {...props} />
  </ServiceScope>
);

const PatientHistoryContent: React.FC<Props> = ({ route, navigation }) => {
  const { id, name } = route.params;
  const { back } = useBack({ name: 'DoctorTabs', params: { screen: 'PatientsTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  const entry = useAppSelector(st => selectPatientHistory(st, id));
  const h = entry.history;
  const seen = h ? h.visits.filter(v => v.status === 'completed').length : 0;

  useEffect(() => {
    void dispatch(loadPatientHistoryAsync(id));
  }, [dispatch, id]);

  return (
    <ScreenShell
      title={h?.patient.name ?? name ?? 'Patient'}
      subtitle={
        h
          ? [h.patient.age !== null ? `${h.patient.age} years` : null, genderLabel(h.patient.gender), seen === 0 ? 'Not seen yet' : seen === 1 ? 'Seen once' : `Seen ${seen} times`]
              .filter(Boolean)
              .join(' · ')
          : undefined
      }
      onBack={back}
      refreshing={entry.status === 'loading' && !!h}
      onRefresh={() => void dispatch(loadPatientHistoryAsync(id))}>
      {entry.status === 'failed' ? (
        <InlineNotice message={entry.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadPatientHistoryAsync(id)) }} />
      ) : null}
      {!h ? (
        entry.status === 'failed' ? null : <RowCardsSkeleton count={4} />
      ) : h.visits.length ? (
        h.visits.map(v => {
          const status = APPOINTMENT_STATUS[v.status];
          const title = v.diagnosis ?? (v.status === 'completed' ? 'No diagnosis recorded' : `${KIND_LABEL[v.kind]} visit`);
          return (
            <Card
              key={v.code}
              onPress={v.appointmentId ? () => navigation.navigate('DoctorAppointment', { id: v.appointmentId }) : undefined}
              accessibilityLabel={`${formatOn(v.startAt)}, ${title}, ${status.label}`}>
              <View style={styles.row}>
                <IonIcon name={v.kind === 'video' ? 'videocam-outline' : 'business-outline'} size="lg" color={service.accentDeep} />
                <View style={styles.grow}>
                  <AppText variant="title">{title}</AppText>
                  <AppText variant="small" tone="muted">{`${formatOn(v.startAt)} · ${KIND_LABEL[v.kind]}${v.prescriptionId ? ' · prescription written' : ''}`}</AppText>
                  {v.reason ? (
                    <AppText variant="small" tone="muted" numberOfLines={2}>
                      {`Came for: ${v.reason}`}
                    </AppText>
                  ) : null}
                  {v.notes ? <AppText variant="body">{v.notes}</AppText> : null}
                  <View style={styles.pill}>
                    <StatusPill label={status.label} tone={status.tone} />
                  </View>
                </View>
                {v.appointmentId ? <IonIcon name="chevron-forward" size="md" color={colors.inkFaint} /> : null}
              </View>
            </Card>
          );
        })
      ) : (
        <EmptyState ion="clipboard-outline" title="No visits yet" body="Their visits with you appear here, with your notes and prescriptions." />
      )}
    </ScreenShell>
  );
};

export default PatientHistory;
