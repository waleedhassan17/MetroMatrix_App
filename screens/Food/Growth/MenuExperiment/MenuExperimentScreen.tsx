// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen growth: a menu test
// ═══════════════════════════════════════════════════════
// One change to one dish (a price or a photo) and how it went: while it
// runs, the days so far (it can be stopped early, putting the old one
// back); at the end, orders and recorded sales a day before and during, a
// plain verdict, and the kitchen's choice: keep it, adjust the price, or go
// back. Nothing changes until the kitchen chooses.

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { changeLine, priceBounds, progressLine, resultLines, validateTestPrice } from '../../../../models/kitchen/reachModel';
import { EXPERIMENT_STATUS, VERDICT } from '../../../../models/kitchen/kitchenStatusModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { Image } from 'expo-image';
import { AppText, Button, Card, Divider, InlineNotice, ProgressBar, ScreenShell, Sheet, SkeletonLines, StatusPill, TextField } from '../../../../Custom-Components/index';
import type { ExperimentDecision } from '../../../../networks/foodGrowth/experimentsNetwork';
import type { FoodVendorStackParamList } from '../../../../types';
import { cdn } from '../../../../utils/cdn';
import { formatWhen } from '../../../../utils/healthTime';
import { formatPKR } from '../../../../utils/money';
import { haptics } from '../../../../utils/haptics';
import { decideExperimentAsync, loadExperimentAsync, selectMenuExperiment } from './menuExperimentSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'GrowthExperiment'>;

const TZ = 'Asia/Karachi';

const makeStyles = ({ space, radius, colors, size }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    tight: { gap: space.s4 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.s12 },
    table: { flexDirection: 'row', gap: space.s12, alignItems: 'baseline' },
    label: { flex: 2, minWidth: 0 },
    cell: { flex: 1, minWidth: 0 },
    photos: { flexDirection: 'row', gap: space.s12 },
    photo: { flex: 1, flexBasis: 0, gap: space.s4 },
    image: { width: '100%', aspectRatio: size.railPhotoAspect, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
  });

const DONE_TOAST: Record<ExperimentDecision['kind'], string> = { keep: 'Kept', adjust: 'Price adjusted', drop: 'Back to how it was', stop: 'Test stopped' };

const MenuExperimentScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <MenuExperimentContent {...props} />
  </ServiceScope>
);

const MenuExperimentContent: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const { back } = useBack({ name: 'GrowthMenuInsights' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectMenuExperiment);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);

  const load = useCallback(() => void dispatch(loadExperimentAsync(id)), [dispatch, id]);
  useFocusEffect(load);

  const e = s.data?.id === id ? s.data : null;
  if (!e) {
    return (
      <ScreenShell title="Menu test" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={s.error.code === 'NOT_FOUND' ? undefined : { label: 'Try again', onPress: load }} /> : <SkeletonLines lines={8} />}
      </ScreenShell>
    );
  }

  const decide = async (decision: ExperimentDecision) => {
    haptics.press();
    const res = await dispatch(decideExperimentAsync({ id, decision }));
    if (decideExperimentAsync.fulfilled.match(res)) {
      haptics.success();
      setAdjusting(null);
      setStopping(false);
      Toast.show({ type: 'success', text1: DONE_TOAST[decision.kind] });
    } else haptics.warning();
  };

  const oldPrice = e.change.kind === 'price' ? e.change.oldPrice : 0;
  const adjustError = adjusting !== null && e.change.kind === 'price' ? validateTestPrice(adjusting, oldPrice) : null;
  const verdict = e.result?.verdict ?? null;
  const decided = !['running', 'done'].includes(e.status);

  return (
    <ScreenShell title={e.itemName} subtitle={e.change.kind === 'price' ? 'Price test' : 'Photo test'} onBack={back} refreshing={s.status === 'loading'} onRefresh={load}>
      {s.actError.message ? <InlineNotice message={s.actError.message} /> : null}
      <Card>
        <View style={styles.gap}>
          <View style={styles.head}>
            <AppText variant="title">{changeLine(e)}</AppText>
            <StatusPill label={EXPERIMENT_STATUS[e.status].label} tone={EXPERIMENT_STATUS[e.status].tone} />
          </View>
          <ProgressBar progress={e.progress.daysIn / e.progress.days} accessibilityLabel={progressLine(e)} />
          <AppText variant="small" tone="muted">
            {`${progressLine(e)} · ${formatWhen(e.startedAt, TZ)} to ${formatWhen(e.endsAt, TZ)}`}
          </AppText>
          {e.change.kind === 'photo' ? (
            <View style={styles.photos}>
              <View style={styles.photo}>
                <Image source={cdn(e.change.oldPhotoUrl, { w: 320 }) ?? undefined} style={styles.image} contentFit="cover" accessibilityLabel="The old photo" />
                <AppText variant="caption" tone="muted">
                  Before
                </AppText>
              </View>
              <View style={styles.photo}>
                <Image source={cdn(e.change.photoUrl, { w: 320 }) ?? undefined} style={styles.image} contentFit="cover" accessibilityLabel="The new photo" />
                <AppText variant="caption" tone="muted">
                  In the test
                </AppText>
              </View>
            </View>
          ) : null}
        </View>
      </Card>

      {e.result ? (
        <Card>
          <View style={styles.gap}>
            <AppText variant="title">{e.status === 'running' ? 'So far' : 'How it went'}</AppText>
            <View style={styles.table}>
              <AppText variant="caption" tone="muted" style={styles.label}>
                A day
              </AppText>
              <AppText variant="caption" tone="muted" style={styles.cell} align="right">
                Before
              </AppText>
              <AppText variant="caption" tone="muted" style={styles.cell} align="right">
                During
              </AppText>
            </View>
            {resultLines(e).map(l => (
              <View key={l.label} style={styles.table}>
                <AppText variant="body" style={styles.label}>
                  {l.label}
                </AppText>
                <AppText variant="body" style={styles.cell} align="right">
                  {l.before}
                </AppText>
                <AppText variant="bodyStrong" style={styles.cell} align="right">
                  {l.during}
                </AppText>
              </View>
            ))}
            {verdict ? (
              <>
                <Divider />
                <View style={styles.tight}>
                  <AppText variant="bodyStrong">{`Suggested: ${VERDICT[verdict].label.toLowerCase()}`}</AppText>
                  <AppText variant="small" tone="muted">
                    {VERDICT[verdict].hint}
                  </AppText>
                </View>
              </>
            ) : null}
            <AppText variant="caption" tone="muted">
              Estimated from your recorded sales. Weather, holidays and deals change orders too.
            </AppText>
          </View>
        </Card>
      ) : (
        <Card>
          <AppText variant="body">Orders and recorded sales show here after the first full day.</AppText>
        </Card>
      )}

      {e.status === 'done' ? (
        <View style={styles.gap}>
          <Button label={e.change.kind === 'price' ? `Keep ${formatPKR(e.change.price)}` : 'Keep the new photo'} variant={verdict === 'keep' ? 'primary' : 'secondary'} loading={s.acting} onPress={() => void decide({ kind: 'keep' })} fullWidth />
          {e.change.kind === 'price' ? (
            <Button label="Adjust the price" variant={verdict === 'adjust' ? 'primary' : 'secondary'} onPress={() => setAdjusting(String(Math.round((e.change.kind === 'price' ? e.change.oldPrice + e.change.price : 0) / 20) * 10))} fullWidth />
          ) : null}
          <Button label={e.change.kind === 'price' ? `Go back to ${formatPKR(oldPrice)}` : 'Go back to the old photo'} variant={verdict === 'drop' ? 'primary' : 'secondary'} loading={s.acting} onPress={() => void decide({ kind: 'drop' })} fullWidth />
        </View>
      ) : null}
      {e.status === 'running' ? <Button label="Stop the test early" variant="secondary" onPress={() => setStopping(true)} fullWidth /> : null}
      {decided && e.decidedAt ? (
        <AppText variant="small" tone="muted">
          {`${EXPERIMENT_STATUS[e.status].label} on ${formatWhen(e.decidedAt, TZ)}.`}
        </AppText>
      ) : null}

      <Sheet
        visible={adjusting !== null}
        onClose={() => setAdjusting(null)}
        title="Adjust the price"
        subtitle={`Was ${formatPKR(oldPrice)}${e.change.kind === 'price' ? `, tested at ${formatPKR(e.change.price)}` : ''}`}
        footer={<Button label="Save this price" loading={s.acting} disabled={!!adjustError} onPress={() => void decide({ kind: 'adjust', price: Number(adjusting) })} fullWidth />}>
        <TextField
          label="New price"
          mode="numeric"
          value={adjusting ?? ''}
          onChangeText={setAdjusting}
          helper={`Between ${formatPKR(priceBounds(oldPrice).min)} and ${formatPKR(priceBounds(oldPrice).max)}`}
          error={adjusting && adjustError ? adjustError : undefined}
        />
      </Sheet>

      <Sheet
        visible={stopping}
        onClose={() => setStopping(false)}
        title="Stop this test?"
        subtitle={e.change.kind === 'price' ? `${e.itemName} goes back to ${formatPKR(oldPrice)}.` : `${e.itemName} gets its old photo back.`}
        footer={<Button label="Stop it" variant="destructive" loading={s.acting} onPress={() => void decide({ kind: 'stop' })} fullWidth />}>
        <Button label="Keep testing" variant="secondary" onPress={() => setStopping(false)} fullWidth />
      </Sheet>
    </ScreenShell>
  );
};

export default MenuExperimentScreen;
