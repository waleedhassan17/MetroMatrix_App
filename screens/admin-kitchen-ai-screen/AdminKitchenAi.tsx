// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: the assistant
// ═══════════════════════════════════════════════════════
// The last 30 days of voice and AI drafts across Food Court: how many, how
// many failed, how long they took, by feature and by kitchen. The switch
// turns the assistant off for everyone (the manual forms stay); it is a
// platform setting, confirmed with the admin's authenticator code. A
// kitchen's monthly allowance is its plan's, changed on its page.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { aiFeatureLabel, failedLabel, secondsLabel } from '../../models/kitchen/adminKitchenModel';
import { useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, Divider, InlineNotice, ScreenShell, Sheet, SkeletonLines, TextField, ToggleRow } from '../../Custom-Components/index';
import { RowCard, SectionHead, StatGrid, type AdminStat } from '../../Components/admin/AdminParts';
import type { AdminFoodStackParamList } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { loadAiUsageAsync, openSwitchSheet, selectAdminKitchenAi, setSwitchCode, switchAiAsync } from './adminKitchenAiSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminKitchenAi'>;

const n = (x: number) => x.toLocaleString('en-US');

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    section: { gap: space.s8 },
    row: { gap: space.s4, paddingVertical: space.s8 },
  });

const AdminKitchenAi: React.FC<Props> = () => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAdminKitchenAi);
  const r = s.report;
  const sheet = s.sheet;

  const load = useCallback(() => void dispatch(loadAiUsageAsync()), [dispatch]);
  useFocusEffect(load);

  const confirm = () => {
    if (!sheet || sheet.code.length !== 6) return haptics.warning();
    void dispatch(switchAiAsync(sheet));
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
    { key: 'cached', icon: 'flash-outline', tint: 'blue', value: r ? n(r.totals.cached) : null, label: 'Answered from cache', hint: 'No model call' },
  ];

  return (
    <ScreenShell title="The assistant" subtitle={r ? `The last ${r.days} days` : 'Voice and AI drafts'} onBack={back} refreshing={s.status === 'loading' && !!r} onRefresh={load}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {!r && s.status !== 'failed' ? <SkeletonLines lines={10} /> : null}
      {r ? (
        <>
          <Card>
            <ToggleRow
              label="Assistant on for everyone"
              helper={`Off: voice and drafts stop for every kitchen and customer. The ordinary forms stay.${r.model ? ` Model: ${r.model}.` : ' No model is set up on the server.'}`}
              value={r.enabled}
              disabled={s.busy}
              onChange={v => dispatch(openSwitchSheet(v))}
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
                        {`${n(f.actions)} ${f.actions === 1 ? 'action' : 'actions'} · ${failedLabel(f.failures, f.actions)} · typically ${secondsLabel(f.p50Ms)}, slowest ${secondsLabel(f.p95Ms)}`}
                      </AppText>
                    </View>
                  </View>
                ))
              ) : (
                <AppText variant="body">{`No assistant actions in these ${r.days} days.`}</AppText>
              )}
            </Card>
          </View>

          <View style={styles.section}>
            <SectionHead title="By kitchen" />
            {r.byBusiness.map(b => (
              <RowCard
                key={b.businessId}
                title={b.name}
                mark={{ icon: 'storefront-outline', tint: 'violet' }}
                lines={[`${n(b.actions)} in these ${r.days} days · ${failedLabel(b.failures, b.actions)}`]}
                accessibilityLabel={`${b.name}, ${n(b.actions)} actions`}
              />
            ))}
            <AppText variant="caption" tone="muted">
              A kitchen’s monthly allowance comes with its plan: change it on its page in Food → Vendors.
            </AppText>
          </View>
        </>
      ) : null}

      <Sheet
        visible={!!sheet}
        onClose={() => dispatch(openSwitchSheet(null))}
        title={sheet?.enabled ? 'Turn the assistant on' : 'Turn the assistant off'}
        subtitle="A platform setting: confirm it with the code from your authenticator app."
        footer={<Button label="Confirm" loading={s.busy} disabled={(sheet?.code.length ?? 0) !== 6} onPress={confirm} fullWidth />}>
        {s.actionError.message ? <InlineNotice message={s.actionError.message} /> : null}
        <TextField label="6-digit code" mode="numeric" value={sheet?.code ?? ''} onChangeText={t => dispatch(setSwitchCode(t))} autoCorrect={false} />
      </Sheet>
    </ScreenShell>
  );
};

export default AdminKitchenAi;
