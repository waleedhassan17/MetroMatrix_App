// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: my dawat requests
// ═══════════════════════════════════════════════════════
// Each catering request with its kitchen, the event and where it stands
// (waiting for a quote, a quote to look at, the advance to pay, confirmed).

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { CATERING_STATUS } from '../../../../models/kitchen/kitchenStatusModel';
import { eventLine, latestQuote } from '../../../../models/kitchen/cateringModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { EmptyState, InlineNotice, ScreenShell, SkeletonLines } from '../../../../Custom-Components/index';
import { RowCard } from '../../../../Components/admin/AdminParts';
import type { FoodAppParamList } from '../../../../types';
import { formatPKR } from '../../../../utils/money';
import { loadMyCateringAsync, selectFoodCateringRequests } from './foodCateringRequestsSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodCateringRequests'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s12 },
  });

const FoodCateringRequestsScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodCateringRequestsContent {...props} />
  </ServiceScope>
);

const FoodCateringRequestsContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectFoodCateringRequests);
  const load = useCallback(() => void dispatch(loadMyCateringAsync()), [dispatch]);
  useFocusEffect(load);

  return (
    <ScreenShell title="Dawat requests" subtitle="Catering from Food Court kitchens" onBack={back} refreshing={s.status === 'loading' && !!s.items.length} onRefresh={load}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {s.status === 'loading' && !s.items.length ? (
        <SkeletonLines lines={6} />
      ) : !s.items.length && s.status === 'succeeded' ? (
        <EmptyState icon="users" title="No dawat requests yet" body="Planning a mehndi, an aqiqah or an office lunch? Ask a kitchen from its page: “Plan a dawat”." />
      ) : (
        <View style={styles.list}>
          {s.items.map(r => {
            const q = latestQuote(r);
            return (
              <RowCard
                key={r.code}
                title={r.vendor.name}
                mark={{ icon: 'people-outline', tint: 'violet' }}
                lines={[eventLine(r), q ? `Quote v${q.version}: ${formatPKR(q.total)}` : `${r.dishes.length} dishes asked for`]}
                pill={{ label: CATERING_STATUS[r.status].label, tone: CATERING_STATUS[r.status].tone }}
                onPress={() => navigation.navigate('FoodCateringRequest', { code: r.code })}
              />
            );
          })}
        </View>
      )}
    </ScreenShell>
  );
};

export default FoodCateringRequestsScreen;
