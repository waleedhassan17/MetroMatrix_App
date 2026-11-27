// ═══════════════════════════════════════════════════════
// MetroMatrix — Your patients
// ═══════════════════════════════════════════════════════
// Everyone who has booked with you (and only them), each a white card: how
// many times you've seen them (completed visits only), and their next or
// last booking; open one for their history with you. Search by name or phone.

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useDebouncedValue, usePagedList } from '../../hooks/usePagedList';
import { useNow } from '../../hooks/useNow';
import { fetchPatients } from '../../networks/health/doctor/patients';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { EmptyState, InlineNotice, PageHeader, RowCardsSkeleton } from '../../Custom-Components/index';
import { SearchField } from '../../Components/shopping/ShopParts';
import { RowCard } from '../../Components/admin/AdminParts';
import type { DoctorPartnerStackParamList, PatientRow } from '../../models';
import { formatOn } from '../../utils/health-time/healthTime';
import { genderLabel } from '../../models/health/familyMemberModel';
import { selectPatientQuery, setPatientQuery } from './doctorPatientsSlice';
import { patientRowPageSerializer } from '../../serializers/health/doctorSerializer';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'DoctorTabs'>;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    list: { paddingHorizontal: gutter, paddingTop: space.s16, paddingBottom: space.s40 },
    gap: { height: space.s12 },
  });

/** "Seen 3 times", "Not seen yet": cancelled and missed bookings aren't visits. */
const seenLabel = (p: PatientRow) => (p.visits === 0 ? 'Not seen yet' : p.visits === 1 ? 'Seen once' : `Seen ${p.visits} times`);

const DoctorPatients: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <DoctorPatientsContent {...props} />
  </ServiceScope>
);

const DoctorPatientsContent: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const query = useAppSelector(selectPatientQuery);
  const q = useDebouncedValue(query.trim());
  const list = usePagedList((page, size) => fetchPatients(q, page, size), patientRowPageSerializer, `patients|${q}`);
  const now = useNow();
  const Gap = React.useCallback(() => <View style={styles.gap} />, [styles.gap]);

  return (
    <View style={styles.root}>
      <PageHeader
        title="Patients"
        subtitle={list.isLoading || q ? 'People who booked with you' : `${list.total} ${list.total === 1 ? 'person has' : 'people have'} booked with you`}>
        <SearchField value={query} onChange={t => dispatch(setPatientQuery(t))} placeholder="Find a patient" />
      </PageHeader>
      <FlatList
        data={list.rows}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Gap}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item }) => {
          const ahead = Date.parse(item.lastVisitAt) > now;
          return (
            <RowCard
              title={item.name}
              mark={{ name: item.name }}
              // The same two lines for everyone: who, then when.
              lines={[
                [item.age !== null ? `${item.age} years` : null, genderLabel(item.gender), seenLabel(item)].filter(Boolean).join(' · '),
                ahead ? `Next visit ${formatOn(item.lastVisitAt)}` : `Last booking ${formatOn(item.lastVisitAt)}`,
              ]}
              pill={ahead ? { label: 'Coming up', tone: 'info' } : undefined}
              onPress={() => navigation.navigate('PatientHistory', { id: item.id, name: item.name })}
              chevron
            />
          );
        }}
        ListEmptyComponent={
          list.isLoading ? (
            <RowCardsSkeleton count={5} lines={2} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : q ? (
            <EmptyState icon="search-outline" title={`No patient matches "${q}"`} body="Try their name, or the phone number they booked with." />
          ) : (
            <EmptyState icon="people-outline" title="No patients yet" body="Patients appear here after their first booking with you." />
          )
        }
      />
    </View>
  );
};

export default DoctorPatients;
