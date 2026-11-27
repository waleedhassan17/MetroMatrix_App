// ═══════════════════════════════════════════════════════
// MetroMatrix — Needs you (one of Today's counts, as a list)
// ═══════════════════════════════════════════════════════
// The visits behind one "Needs you" count on Today: transfers to confirm,
// clinic fees to mark paid, prescriptions to write, refunds to record (GET
// /health/doctor/appointments?needs=…, any date). Each row opens the visit,
// where the one thing to do waits. Stateless: a server-paged list.

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePagedList } from '../../hooks/usePagedList';
import { useBack } from '../../hooks/useBack';
import { fetchDoctorAppointments } from '../../networks/health/doctor/doctorAppointments';
import { queuePageSerializer } from '../../serializers/health/doctorSerializer';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { EmptyState, InlineNotice, PageHeader, RowCard, RowCardsSkeleton } from '../../Custom-Components/index';
import type { DoctorNeed, DoctorPartnerStackParamList, QueueItem } from '../../models';
import { NEED_COPY } from '../../models/health/doctorTodayModel';
import { APPOINTMENT_PAYMENT_STATUS } from '../../models/health/appointmentStatusModel';
import { formatDayShort, formatSlot, dateInZone } from '../../utils/health-time/healthTime';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'DoctorNeeds'>;

const makeStyles = ({ colors, space, gutter, listGap }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    list: { paddingHorizontal: gutter, paddingTop: space.s20, paddingBottom: space.s40 },
    gap: { height: listGap },
  });

const DoctorNeeds: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <DoctorNeedsContent {...props} />
  </ServiceScope>
);

/** "Sat 29 Nov, 10:30 AM": when the visit was, in the practice's time. */
const when = (q: QueueItem) => `${formatDayShort(dateInZone(q.startAt, q.timezone))}, ${formatSlot(q.startAt, q.timezone)}`;

const DoctorNeedsContent: React.FC<Props> = ({ navigation, route }) => {
  const kind: DoctorNeed = route.params.kind;
  const copy = NEED_COPY[kind] ?? NEED_COPY.transfer;
  const { back } = useBack({ name: 'DoctorTabs' });
  const styles = useStyles(makeStyles);
  const list = usePagedList((page, size) => fetchDoctorAppointments({ needs: kind, page, pageSize: size }), queuePageSerializer, `needs|${kind}`);
  const Gap = React.useCallback(() => <View style={styles.gap} />, [styles.gap]);
  // Back from a visit, the list reads again in place (usePagedList), so what was done drops off.

  return (
    <View style={styles.root}>
      <PageHeader
        title={copy.title}
        subtitle={list.isLoading ? copy.subtitle : `${list.total} ${list.total === 1 ? 'visit' : 'visits'} · ${copy.subtitle}`}
        onBack={back}
      />
      <FlatList
        data={list.rows}
        keyExtractor={q => q.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Gap}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        renderItem={({ item: q }) => {
          const payment = APPOINTMENT_PAYMENT_STATUS[q.paymentStatus];
          return (
            <RowCard
              title={q.patient.name}
              mark={{ name: q.patient.name }}
              lines={[when(q), q.locationName]}
              pill={{ label: payment.label, tone: payment.tone }}
              onPress={() => navigation.navigate('DoctorAppointment', { id: q.id })}
              chevron
            />
          );
        }}
        ListEmptyComponent={
          list.isLoading ? (
            <RowCardsSkeleton count={4} lines={2} pill />
          ) : list.error ? (
            <InlineNotice message={list.error} action={{ label: 'Try again', onPress: list.reload }} />
          ) : (
            <EmptyState icon="checkmark-done-outline" title={copy.emptyTitle} body={copy.emptyBody} />
          )
        }
      />
    </View>
  );
};

export default DoctorNeeds;
