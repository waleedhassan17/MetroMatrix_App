// ═══════════════════════════════════════════════════════
// MetroMatrix — Your patients
// ═══════════════════════════════════════════════════════
// Everyone who has booked with you (and only them): last visit and how many
// visits; open one for their history with you.

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useDebouncedValue, usePagedList } from '../../../../hooks/usePagedList';
import { getPatientsAPI } from '../../../../networks/health/doctor/patientsNetwork';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { Avatar, Divider, EmptyState, InlineNotice, ListRow, PageHeader, SkeletonLines } from '../../../../Custom-Components/index';
import { SearchField } from '../../../../Components/shopping/ShopParts';
import type { DoctorPartnerStackParamList } from '../../../../types';
import { formatOn } from '../../../../utils/healthTime';
import { genderLabel } from '../../../../models/health/familyMemberModel';
import { selectPatientQuery, setPatientQuery } from './doctorPatientsSlice';
import { patientRowPageSerializer } from '../../../../serializers/health/doctorSerializer';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'DoctorTabs'>;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    list: { paddingHorizontal: gutter, paddingBottom: space.s40 },
    state: { paddingTop: space.s16 },
  });

const DoctorPatientsScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <DoctorPatientsContent {...props} />
  </ServiceScope>
);

const DoctorPatientsContent: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const query = useAppSelector(selectPatientQuery);
  const q = useDebouncedValue(query.trim());
  const list = usePagedList((page, size) => getPatientsAPI(q, page, size), patientRowPageSerializer, `patients|${q}`);

  return (
    <View style={styles.root}>
      <PageHeader title="Patients" subtitle={list.isLoading ? 'Your patients' : `${list.total} ${list.total === 1 ? 'patient' : 'patients'} have seen you`}>
        <SearchField value={query} onChange={t => dispatch(setPatientQuery(t))} placeholder="Find a patient" />
      </PageHeader>
      <FlatList
        data={list.rows}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={[item.age !== null ? `${item.age} years` : null, genderLabel(item.gender), `${item.visits} ${item.visits === 1 ? 'visit' : 'visits'}`, `last ${formatOn(item.lastVisitAt)}`].filter(Boolean).join(' · ')}
            left={<Avatar name={item.name} size="sm" />}
            onPress={() => navigation.navigate('PatientHistory', { id: item.id, name: item.name })}
            chevron
          />
        )}
        ListEmptyComponent={
          <View style={styles.state}>
            {list.isLoading ? (
              <SkeletonLines lines={6} />
            ) : list.error ? (
              <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
            ) : (
              <EmptyState icon="users" title={q ? `No patient matches "${q}"` : 'No patients yet'} body="Patients appear here after their first booking with you." />
            )}
          </View>
        }
      />
    </View>
  );
};

export default DoctorPatientsScreen;
