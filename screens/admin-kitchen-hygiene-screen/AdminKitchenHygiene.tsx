// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: hygiene checks
// ═══════════════════════════════════════════════════════
// Kitchens that ticked their hygiene checklist and asked MetroMatrix to
// verify it, oldest first; the verified ones and the ones sent back with a
// note sit in their own tabs. A row opens the checklist and its photos.

import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { HYGIENE_STATUS } from '../../models/kitchen/kitchenStatusModel';
import { formatDate } from '../../utils/dates/dates';
import { useStyles, type Theme } from '../../theme/index';
import { AppText, InlineNotice, ScreenShell, SegmentTabs, SkeletonLines } from '../../Custom-Components/index';
import { RowCard } from '../../Components/admin/AdminParts';
import type { AdminFoodStackParamList } from '../../models';
import { loadHygieneAsync, selectAdminKitchenHygiene, setHygieneTab, type HygieneTab } from './adminKitchenHygieneSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminKitchenHygiene'>;

const TABS: { key: HygieneTab; label: string }[] = [
  { key: 'pending', label: 'Waiting' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Sent back' },
];

const makeStyles = ({ space }: Theme) => StyleSheet.create({ list: { gap: space.s12 } });

const AdminKitchenHygiene: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAdminKitchenHygiene);

  // A link from the overview opens a tab once.
  useEffect(() => {
    if (route.params?.status) dispatch(setHygieneTab(route.params.status));
  }, [dispatch, route.params?.status]);

  const load = useCallback(() => void dispatch(loadHygieneAsync(s.tab)), [dispatch, s.tab]);
  useFocusEffect(load);

  const done = (items: { done: boolean }[]) => `${items.filter(i => i.done).length} of ${items.length} ticked`;

  return (
    <ScreenShell
      title="Hygiene checks"
      subtitle="Kitchens asking MetroMatrix to verify their checklist"
      onBack={back}
      refreshing={s.status === 'loading' && !!s.items.length}
      onRefresh={load}
      headerContent={<SegmentTabs options={TABS} value={s.tab} onChange={t => dispatch(setHygieneTab(t))} accessibilityLabel="Which checks" />}>
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {s.status === 'loading' && !s.items.length ? <SkeletonLines lines={6} /> : null}
      <View style={styles.list}>
        {s.items.map(h => (
          <RowCard
            key={h.businessId}
            title={h.vendor?.name ?? 'Kitchen'}
            mark={{ icon: 'shield-checkmark-outline', tint: h.status === 'verified' ? 'accent' : 'amber' }}
            lines={[
              `${h.vendor?.isHomeKitchen ? 'Home kitchen' : 'Kitchen'} · ${done(h.items)}`,
              h.status === 'pending' && h.requestedAt ? `Asked on ${formatDate(h.requestedAt)}` : h.reviewedAt ? `Reviewed on ${formatDate(h.reviewedAt)}` : null,
              h.note ? `Note: ${h.note}` : null,
            ]}
            pill={{ label: h.status === 'pending' ? 'Waiting' : HYGIENE_STATUS[h.status].vendorLabel, tone: HYGIENE_STATUS[h.status].tone }}
            onPress={() => navigation.navigate('AdminKitchenHygieneReview', { businessId: h.businessId, name: h.vendor?.name })}
          />
        ))}
      </View>
      {s.status === 'succeeded' && !s.items.length ? (
        <AppText variant="body">{s.tab === 'pending' ? 'No kitchen is waiting for a check.' : s.tab === 'verified' ? 'No kitchen verified yet.' : 'No kitchen sent back.'}</AppText>
      ) : null}
    </ScreenShell>
  );
};

export default AdminKitchenHygiene;
