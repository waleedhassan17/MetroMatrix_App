// The patient's prescriptions as one list (newest first), each the one list
// card: what it was for, the doctor, the day and who it's for. Shared by
// Prescriptions and the Records tab's Prescriptions view.

import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { usePagedList } from '../../hooks/usePagedList';
import { useHealthNav } from '../../hooks/useHealth';
import { fetchPrescriptions } from '../../networks/health/prescriptions';
import { useStyles, type Theme } from '../../theme/index';
import { EmptyState, InlineNotice, RowCard, RowCardsSkeleton } from '../../Custom-Components/index';
import { prescriptionSummaryPageSerializer } from '../../serializers/health/recordsSerializer';
import { formatOn } from '../../utils/health-time/healthTime';

const makeStyles = ({ space, gutter, listGap }: Theme) =>
  StyleSheet.create({
    list: { padding: gutter, gap: listGap, paddingBottom: space.s40 },
  });

export const PrescriptionRows: React.FC = () => {
  const styles = useStyles(makeStyles);
  const nav = useHealthNav();
  const list = usePagedList((page, size) => fetchPrescriptions(page, size), prescriptionSummaryPageSerializer, 'prescriptions');
  return (
    <FlatList
      data={list.rows}
      keyExtractor={p => p.id}
      contentContainerStyle={styles.list}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.5}
      onRefresh={list.refresh}
      refreshing={list.isRefreshing}
      renderItem={({ item }) => (
        <RowCard
          title={item.diagnosis || 'Prescription'}
          mark={{ icon: 'document-text-outline' }}
          lines={[`${item.doctorName} · ${item.specialtyName}`, `${formatOn(item.issuedAt)} · for ${item.patientName}`]}
          onPress={() => nav.openPrescription(item.id)}
          chevron
        />
      )}
      ListEmptyComponent={
        list.isLoading ? (
          <RowCardsSkeleton count={4} lines={2} />
        ) : list.error ? (
          <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
        ) : (
          <EmptyState icon="document-text-outline" title="No prescriptions yet" body="When a doctor writes one after your visit, it appears here and on the appointment." />
        )
      }
    />
  );
};
