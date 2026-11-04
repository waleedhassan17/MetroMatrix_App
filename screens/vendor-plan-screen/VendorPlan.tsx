// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor plan
// ═══════════════════════════════════════════════════════
// Every Food Court vendor is on the Community plan: free, with no commission
// on orders. The page shows what it allows and how much is used. There is
// nothing to buy here.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { formatPKR } from '../../utils/money/money';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Card, InlineNotice, IonIcon, ProgressBar, RowCardsSkeleton, ScreenShell, SectionCard } from '../../Custom-Components/index';
import type { FoodVendorStackParamList } from '../../models';
import { useTheme } from '../../theme/index';
import { loadVendorPlanAsync, selectVendorPlan } from './vendorPlanSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorPlan'>;

/** The limits a vendor recognises, in their words. */
const LIMIT_LABEL: Record<string, string> = {
  menu_items: 'Menu items',
  riders: 'Riders',
  promotions_active: 'Active promotions',
  branches: 'Branches',
  brands: 'Brands',
};
const ORDER = ['menu_items', 'riders', 'promotions_active', 'branches'];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    hero: { gap: space.s8 },
    heroHead: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    usage: { gap: space.s16 },
    row: { gap: space.s8 },
    rowHead: { flexDirection: 'row', justifyContent: 'space-between' },
    points: { gap: space.s8 },
    point: { flexDirection: 'row', gap: space.s8, alignItems: 'flex-start' },
    grow: { flex: 1 },
  });

const VendorPlan: React.FC<Props> = props => (
  <ServiceScope service="food">
    <VendorPlanContent {...props} />
  </ServiceScope>
);

const VendorPlanContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const s = useAppSelector(selectVendorPlan);
  const plan = s.plan;

  useEffect(() => {
    void dispatch(loadVendorPlanAsync());
  }, [dispatch]);

  return (
    <ScreenShell title="Your plan" onBack={back} refreshing={s.status === 'loading' && !!plan} onRefresh={() => void dispatch(loadVendorPlanAsync())}>
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadVendorPlanAsync()) }} /> : null}
      {!plan ? (
        s.status === 'failed' ? null : <RowCardsSkeleton count={2} />
      ) : (
        <>
          <Card style={styles.hero}>
            <View style={styles.heroHead}>
              <IonIcon name="leaf-outline" size="lg" color={colors.success} />
              <AppText variant="cardTitle">{`${plan.label} plan`}</AppText>
            </View>
            <AppText variant="title" tone="success">
              {plan.price === 0 ? 'Free' : formatPKR(plan.price)}
            </AppText>
            <AppText variant="body" tone="muted">
              No commission, ever. Customers pay you directly and every rupee of the order is yours.
            </AppText>
          </Card>

          <SectionCard title="What you’re using">
            {ORDER.filter(k => plan.limits[k] !== undefined).map(k => {
              const used = plan.usage[k] ?? 0;
              const limit = plan.limits[k];
              return (
                <View key={k} style={styles.row}>
                  <View style={styles.rowHead}>
                    <AppText variant="bodyStrong">{LIMIT_LABEL[k] ?? k}</AppText>
                    <AppText variant="body" tone="muted">{`${used} of ${limit}`}</AppText>
                  </View>
                  <ProgressBar progress={limit > 0 ? Math.min(1, used / limit) : 0} accessibilityLabel={`${LIMIT_LABEL[k] ?? k}: ${used} of ${limit}`} />
                </View>
              );
            })}
          </SectionCard>

          <Card style={styles.points}>
            {[
              'Your own riders, or hand orders to someone you trust',
              'Promotions, insights and pre-orders included',
              'Payments go straight to your cash, wallet or bank',
            ].map(p => (
              <View key={p} style={styles.point}>
                <IonIcon name="checkmark-circle" size="md" color={colors.success} />
                <AppText variant="body" style={styles.grow}>
                  {p}
                </AppText>
              </View>
            ))}
          </Card>
        </>
      )}
    </ScreenShell>
  );
};

export default VendorPlan;
