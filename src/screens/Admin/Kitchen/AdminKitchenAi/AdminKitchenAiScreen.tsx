// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: the assistant
// ═══════════════════════════════════════════════════════
// The last 30 days of voice and AI drafts across Food Court: how many, how
// many failed, how long they took, by feature and by kitchen or customer.
// The switch turns the assistant off for everyone (the manual forms stay);
// a kitchen's or customer's monthly limit can be raised or lowered.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import {
  PLAN_LIMIT,
  aiFeatureLabel,
  failedLabel,
  quotaLine,
  secondsLabel,
  validateQuota,
} from '@models/kitchen/adminKitchenModel';
import { formatDayShort } from '@utils/healthTime';
import { useStyles, type Theme } from '@theme/index';
import {
  AppText,
  Button,
  Card,
  Divider,
  InlineNotice,
  ScreenShell,
  Sheet,
  SkeletonLines,
  TextField,
  ToggleRow,
} from '@custom/index';
import { RowCard, SectionHead, StatGrid, type AdminStat } from '@components/admin/AdminParts';
import type { AdminFoodStackParamList } from '@/types';
import { haptics } from '@utils/haptics';
import {
  changeAiAsync,
  loadAiUsageAsync,
  markQuotaSubmitted,
  openQuotaSheet,
  selectAdminKitchenAi,
  setQuotaLimit,
} from './adminKitchenAiSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminKitchenAi'>;

const n = (x: number) => x.toLocaleString('en-US');

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    section: { gap: space.s8 },
    row: { gap: space.s4, paddingVertical: space.s8 },
  });

const AdminKitchenAiScreen: React.FC<Props> = () => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAdminKitchenAi);
  const r = s.report;
  const sheet = s.sheet;
  const errors = sheet && s.submitted ? validateQuota(sheet.limit) : {};

  const load = useCallback(() => void dispatch(loadAiUsageAsync()), [dispatch]);
  useFocusEffect(load);

  const saveQuota = (limit: string) => {
    if (!sheet) return;
    dispatch(markQuotaSubmitted());
    if (Object.keys(validateQuota(limit)).length) return haptics.warning();
    void dispatch(
      changeAiAsync({ kind: 'quota', ownerId: sheet.ownerId, limit: limit.trim() ? Number(limit) : null }),
    );
  };

  const stats: AdminStat[] = [
    { key: 'actions', icon: 'sparkles-outline', tint: 'violet', value: r ? n(r.totals.actions) : null, label: 'Actions', hint: 'Voice and drafts' },
    {
      key: 'failed',
      icon: 'alert-circle-outline',
      tint: 'rose',
      value: r ? `${Math.round(r.totals.failureRate * 100)}%` : null,
      label: 'Failed',
      hint: r ? `${n(r.totals.failures)} of ${n(r.totals.actions)}` : null,
    },
    { key: 'p50', icon: 'time-outline', tint: 'blue', value: r ? secondsLabel(r.totals.p50Ms) : null, label: 'Typical answer', hint: 'Half are quicker' },
    { key: 'p95', icon: 'hourglass-outline', tint: 'amber', value: r ? secondsLabel(r.totals.p95Ms) : null, label: 'Slowest 5%', hint: 'Take this long or more' },
  ];

  return (
    <ScreenShell
      title="The assistant"
      subtitle={r ? `${formatDayShort(r.from)} – ${formatDayShort(r.to)}` : 'Voice and AI drafts'}
      onBack={back}
      refreshing={s.status === 'loading' && !!r}
      onRefresh={load}>
      {s.status === 'failed' ? (
        <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} />
      ) : null}
      {s.actionError.message && !sheet ? <InlineNotice message={s.actionError.message} /> : null}
      {!r && s.status !== 'failed' ? <SkeletonLines lines={10} /> : null}
      {r ? (
        <>
          <Card>
            <ToggleRow
              label="Assistant on for everyone"
              helper="Off: voice and drafts stop for every kitchen and customer. The ordinary forms stay."
              value={r.enabled}
              disabled={s.busy}
              onChange={v => void dispatch(changeAiAsync({ kind: 'enabled', enabled: v }))}
            />
          </Card>
          <StatGrid stats={stats} />

          <View style={styles.section}>
            <SectionHead title="By feature" />
            <Card>
              {r.byFeature.length ? (
                r.byFeature.map((f, i) => (
                  <View key={f.feature}>
                    {i ? <Divider /> : null}
                    <View style={styles.row}>
                      <AppText variant="bodyStrong">{aiFeatureLabel(f.feature)}</AppText>
                      <AppText variant="small" tone="muted">
                        {`${n(f.actions)} ${f.actions === 1 ? 'action' : 'actions'} · ${failedLabel(f.failures, f.actions)} · ${secondsLabel(f.avgMs)} on average`}
                      </AppText>
                    </View>
                  </View>
                ))
              ) : (
                <AppText variant="body">No assistant actions in these 30 days.</AppText>
              )}
            </Card>
          </View>

          <View style={styles.section}>
            <SectionHead title="By kitchen and customer" />
            {r.byOwner.map(o => (
              <RowCard
                key={o.ownerId}
                title={o.name}
                mark={o.kind === 'kitchen' ? { icon: 'storefront-outline', tint: 'violet' } : { icon: 'person-outline', tint: 'blue' }}
                lines={[
                  `${o.kind === 'kitchen' ? 'Kitchen' : 'Customer'} · ${quotaLine(o)}`,
                  `${n(o.actions)} in these 30 days · ${failedLabel(o.failures, o.actions)}`,
                ]}
                pill={o.override !== null ? { label: 'Own limit', tone: 'accent' } : undefined}
                onPress={() => dispatch(openQuotaSheet(o))}
                accessibilityLabel={`${o.name}, ${quotaLine(o)}. Change the monthly limit`}
              />
            ))}
          </View>
        </>
      ) : null}

      <Sheet
        visible={!!sheet}
        onClose={() => dispatch(openQuotaSheet(null))}
        title={sheet ? `${sheet.name}'s monthly limit` : 'Monthly limit'}
        subtitle={sheet ? `The plan's is ${PLAN_LIMIT[sheet.kind]} assistant actions a month. Voice has its own daily cap.` : undefined}
        footer={<Button label="Save" loading={s.busy} onPress={() => saveQuota(sheet?.limit ?? '')} fullWidth />}>
        {s.actionError.message ? <InlineNotice message={s.actionError.message} /> : null}
        <TextField
          label="Actions a month"
          mode="numeric"
          value={sheet?.limit ?? ''}
          onChangeText={t => dispatch(setQuotaLimit(t))}
          helper="Leave empty for the plan's limit."
          error={errors.limit}
        />
        <Button label="Use the plan's limit" variant="ghost" disabled={s.busy} onPress={() => saveQuota('')} fullWidth />
      </Sheet>
    </ScreenShell>
  );
};

export default AdminKitchenAiScreen;
