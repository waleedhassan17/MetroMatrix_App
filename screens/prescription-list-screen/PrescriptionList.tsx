// ═══════════════════════════════════════════════════════
// MetroMatrix — Prescriptions
// ═══════════════════════════════════════════════════════
// Every prescription from a visit, newest first: diagnosis, doctor, date,
// and who it was for.

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBack } from '../../hooks/useBack';
import { usePagedList } from '../../hooks/usePagedList';
import { useHealthNav } from '../../hooks/useHealth';
import { getPrescriptionsAPI } from '../../networks/health/prescriptionsNetwork';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Card, EmptyState, IonIcon, InlineNotice, PageHeader, SkeletonLines } from '../../Custom-Components/index';
import type { AccountStackParamList } from '../../models';
import { formatOn } from '../../utils/health-time/healthTime';
import { prescriptionSummaryPageSerializer } from '../../serializers/health/recordsSerializer';

type Props = NativeStackScreenProps<AccountStackParamList, 'PrescriptionList'>;

const makeStyles = ({ colors, space, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    list: { padding: gutter, gap: space.s12, paddingBottom: space.s40 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
  });

const PrescriptionList: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <PrescriptionListContent {...props} />
  </ServiceScope>
);

const PrescriptionListContent: React.FC<Props> = () => {
  const { back, canGoBack } = useBack({ name: 'HealthTabs', params: { screen: 'HealthProfileTab' } });
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  const nav = useHealthNav();
  const list = usePagedList((page, size) => getPrescriptionsAPI(page, size), prescriptionSummaryPageSerializer, 'prescriptions');

  return (
    <View style={styles.root}>
      <PageHeader title="Prescriptions" subtitle="From your visits, newest first" onBack={canGoBack ? back : undefined} />
      <FlatList
        data={list.rows}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item }) => (
          <Card onPress={() => nav.openPrescription(item.id)} accessibilityLabel={`${item.diagnosis}, ${item.doctorName}, ${formatOn(item.issuedAt)}, for ${item.patientName}`}>
            <View style={styles.row}>
              <IonIcon name="document-text-outline" size="lg" color={service.accentDeep} />
              <View style={styles.grow}>
                <AppText variant="title">{item.diagnosis || 'Prescription'}</AppText>
                <AppText variant="small" tone="muted">{`${item.doctorName} · ${item.specialtyName}`}</AppText>
                <AppText variant="caption" tone="muted">{`${formatOn(item.issuedAt)} · for ${item.patientName}`}</AppText>
              </View>
              <IonIcon name="chevron-forward" size="md" color={colors.inkFaint} />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState icon="file-text" title="No prescriptions yet" body="When a doctor writes one after your visit, it appears here and on the appointment." />
          )
        }
      />
    </View>
  );
};

export default PrescriptionList;
