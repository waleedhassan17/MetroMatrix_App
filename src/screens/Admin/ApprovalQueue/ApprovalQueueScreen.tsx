// ═══════════════════════════════════════════════════════
// MetroMatrix — Approvals queue
// ═══════════════════════════════════════════════════════
// Pending partner applications, oldest first, by service. Skeleton rows on
// first load; pull to refresh; reloads when you come back from a review.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { SERVICE_LABELS, SUBTYPE_LABELS } from '@models/businessModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import {
  Avatar,
  Button,
  Card,
  Divider,
  EmptyState,
  InlineNotice,
  ListRow,
  ScreenShell,
  SegmentTabs,
  Skeleton,
  StatusPill,
} from '@custom/index';
import type { AdminStackParamList } from '@/types';
import { loadQueueAsync, selectApprovalQueue, setTab, type QueueTab } from './approvalQueueSlice';

dayjs.extend(relativeTime);

type Props = NativeStackScreenProps<AdminStackParamList, 'ApprovalQueue'>;

const TABS: { key: QueueTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'shopping', label: 'Shops' },
  { key: 'healthcare', label: 'Doctors' },
  { key: 'food', label: 'Food' },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12 },
    skeletonText: { flex: 1, gap: space.s8 },
  });

const SkeletonRows: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { size, type } = useTheme();
  return (
    <Card padded="horizontal">
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={styles.skeletonRow} accessibilityLabel="Loading" accessibilityRole="progressbar">
          <Skeleton width={size.avatar.md} height={size.avatar.md} shape="pill" />
          <View style={styles.skeletonText}>
            <Skeleton width="70%" />
            <Skeleton width="45%" height={type.small.lineHeight as number} />
          </View>
        </View>
      ))}
    </Card>
  );
};

const ApprovalQueueScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { tab, lists } = useAppSelector(selectApprovalQueue);
  const list = lists[tab];

  useFocusEffect(
    useCallback(() => {
      dispatch(loadQueueAsync({ tab, mode: list.items.length ? 'refresh' : 'initial' }));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, tab]),
  );

  const firstLoad = (list.status === 'loading' || list.status === 'idle') && !list.items.length;

  return (
    <ScreenShell
      eyebrow="Admin"
      title="Approvals"
      subtitle="Partner applications waiting for a decision."
      refreshing={list.status === 'refreshing'}
      onRefresh={() => dispatch(loadQueueAsync({ tab, mode: 'refresh' }))}
      headerContent={<SegmentTabs options={TABS} value={tab} onChange={t => dispatch(setTab(t))} accessibilityLabel="Service" />}>

      {list.status === 'failed' ? (
        <InlineNotice
          message={list.error.message}
          action={{ label: 'Try again', onPress: () => dispatch(loadQueueAsync({ tab, mode: 'initial' })) }}
        />
      ) : null}

      {firstLoad ? (
        <SkeletonRows />
      ) : list.items.length === 0 && list.status === 'loaded' ? (
        <EmptyState icon="check-circle" title="All caught up" body="No applications are waiting in this list." />
      ) : list.items.length ? (
        <Card padded="horizontal">
          {list.items.map((b, i) => (
            <React.Fragment key={b.id}>
              {i > 0 ? <Divider /> : null}
              <ServiceScope service={b.serviceType}>
                <ListRow
                  title={b.name}
                  subtitle={[
                    `${SERVICE_LABELS[b.serviceType].title} · ${SUBTYPE_LABELS[b.subType].title}`,
                    b.city,
                    b.submittedAt ? `submitted ${dayjs(b.submittedAt).fromNow()}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  left={<Avatar name={b.name} size="md" />}
                  right={<StatusPill label="Pending" tone="warning" />}
                  onPress={() => navigation.navigate('BusinessReview', { id: b.id, name: b.name })}
                  accessibilityHint="Opens the application"
                />
              </ServiceScope>
            </React.Fragment>
          ))}
        </Card>
      ) : null}

      {list.nextCursor ? (
        <Button
          label="Load more"
          variant="secondary"
          loading={list.status === 'loadingMore'}
          onPress={() => dispatch(loadQueueAsync({ tab, mode: 'more', cursor: list.nextCursor }))}
        />
      ) : null}
    </ScreenShell>
  );
};

export default ApprovalQueueScreen;
