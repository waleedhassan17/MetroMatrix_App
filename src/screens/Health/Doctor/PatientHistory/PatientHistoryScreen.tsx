// ═══════════════════════════════════════════════════════
// MetroMatrix — A patient's history with you
// ═══════════════════════════════════════════════════════
// Every completed visit with you, newest first: diagnosis, your notes, and
// the prescription. Only your own visits — never other doctors'.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Card, EmptyState, IonIcon, InlineNotice, ScreenShell, SkeletonLines } from '@custom/index';
import { KIND_LABEL } from '@models/health/appointmentStatusModel';
import type { DoctorPartnerStackParamList } from '@/types';
import { formatOn } from '@utils/healthTime';
import { genderLabel } from '@models/health/familyMemberModel';
import { loadPatientHistoryAsync, selectPatientHistory } from './patientHistorySlice';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'PatientHistory'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: space.s12, alignItems: 'flex-start' },
    grow: { flex: 1, gap: space.s4 },
  });

const PatientHistoryScreen: React.FC<Props> = props => (
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

  useEffect(() => {
    void dispatch(loadPatientHistoryAsync(id));
  }, [dispatch, id]);

  return (
    <ScreenShell
      title={h?.patient.name ?? name ?? 'Patient'}
      subtitle={h ? [h.patient.age !== null ? `${h.patient.age} years` : null, genderLabel(h.patient.gender), `${h.visits.length} ${h.visits.length === 1 ? 'visit' : 'visits'} with you`].filter(Boolean).join(' · ') : undefined}
      onBack={back}
      refreshing={entry.status === 'loading' && !!h}
      onRefresh={() => void dispatch(loadPatientHistoryAsync(id))}>
      {entry.status === 'failed' ? <InlineNotice message={entry.error.message} /> : null}
      {!h ? (
        entry.status === 'failed' ? null : <SkeletonLines lines={8} />
      ) : h.visits.length ? (
        h.visits.map(v => (
          <Card key={v.code} onPress={v.appointmentId ? () => navigation.navigate('DoctorAppointment', { id: v.appointmentId }) : undefined} accessibilityLabel={`${formatOn(v.startAt)}, ${v.diagnosis ?? KIND_LABEL[v.kind]}. Open`}>
            <View style={styles.row}>
              <IonIcon name={v.kind === 'video' ? 'videocam-outline' : 'business-outline'} size="lg" color={service.accentDeep} />
              <View style={styles.grow}>
                <AppText variant="title">{v.diagnosis ?? 'No diagnosis recorded'}</AppText>
                <AppText variant="small" tone="muted">{`${formatOn(v.startAt)} · ${KIND_LABEL[v.kind]}${v.prescriptionId ? ' · prescription written' : ''}`}</AppText>
                {v.notes ? <AppText variant="body">{v.notes}</AppText> : null}
              </View>
              <IonIcon name="chevron-forward" size="md" color={colors.inkFaint} />
            </View>
          </Card>
        ))
      ) : (
        <EmptyState icon="clipboard" title="No completed visits yet" body="Completed visits with you appear here, with your notes and prescriptions." />
      )}
    </ScreenShell>
  );
};

export default PatientHistoryScreen;
