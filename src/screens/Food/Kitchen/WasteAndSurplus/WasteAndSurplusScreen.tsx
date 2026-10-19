// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: waste and Bachat Box
// ═══════════════════════════════════════════════════════
// What went to waste over 7 or 30 days and what it cost (by reason and by
// ingredient), logged by hand or spoken; tonight's Bachat Boxes — the
// end-of-day suggestion, the live boxes and how many are reserved, a pickup
// code collected at the counter — and the meals rescued, shared as a line.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { BOX_STATUS, WASTE_REASON_LABEL } from '@models/kitchen/kitchenStatusModel';
import { BACHAT_BOX, discountLabel, isPickupCode } from '@models/kitchen/surplusModel';
import { rescuedShareText, wasteSentence } from '@models/kitchen/wasteModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Button, Card, Divider, InlineNotice, ScreenShell, SegmentTabs, SkeletonLines, TextAction, TextField } from '@custom/index';
import { RowCard, SectionHead, StatGrid } from '@components/admin/AdminParts';
import { VoiceSheetButton } from '@components/voice/VoiceSheet';
import type { FoodVendorStackParamList } from '@/types';
import { formatWhen } from '@utils/healthTime';
import { formatPKR } from '@utils/money';
import { haptics } from '@utils/haptics';
import { shareText } from '@utils/shareText';
import { selectBusiness } from '../../../Auth/authSlice';
import { collectByCodeAsync, loadWasteAndSurplusAsync, logSpokenWasteAsync, selectWasteAndSurplus, setPickupCode, setWasteRange } from './wasteAndSurplusSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenWaste'>;

const TZ = 'Asia/Karachi';
const RANGES: { key: '7d' | '30d'; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    grow: { flex: 1, minWidth: 0 },
    code: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
    codeField: { flex: 1, flexBasis: 0, minWidth: 0 },
  });

const WasteAndSurplusScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <WasteAndSurplusContent {...props} />
  </ServiceScope>
);

const WasteAndSurplusContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'KitchenTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectWasteAndSurplus);
  const kitchen = useAppSelector(selectBusiness)?.name ?? 'Our kitchen';

  const load = useCallback(() => void dispatch(loadWasteAndSurplusAsync(s.range)), [dispatch, s.range]);
  useFocusEffect(load);

  const w = s.summary;
  const rescued = w?.mealsRescued.total ?? 0;

  const collect = async () => {
    const r = await dispatch(collectByCodeAsync());
    if (collectByCodeAsync.fulfilled.match(r) && r.payload) {
      haptics.success();
      Toast.show({ type: 'success', text1: `Hand over ${r.payload.quantity === 1 ? '1 box' : `${r.payload.quantity} boxes`}`, text2: `${r.payload.customerName ?? 'Customer'} · ${r.payload.code}` });
      load();
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title="Waste and Bachat Box"
      subtitle={w ? `${formatPKR(w.cost)} wasted · ${w.mealsRescued.inRange} meals rescued` : 'What went to waste, and what you saved'}
      onBack={back}
      refreshing={s.status === 'loading' && !!w}
      onRefresh={load}
      headerRight={
        <VoiceSheetButton
          context="stock"
          title="Speak what went to waste"
          hint="Try “2 kilo chawal kharab ho gaye”"
          busy={s.logging}
          onConfirm={async a => {
            if (a.kind !== 'waste.log') return false;
            const r = await dispatch(logSpokenWasteAsync({ lines: a.lines, reason: a.reason }));
            if (logSpokenWasteAsync.fulfilled.match(r)) {
              haptics.success();
              Toast.show({ type: 'success', text1: 'Waste logged', text2: r.payload ? `${formatPKR(r.payload.cost)} · stock updated` : undefined });
              load();
              return true;
            }
            haptics.warning();
            return false;
          }}
        />
      }
      footer={<Button label="Log waste" leftIcon="trash-outline" onPress={() => navigation.navigate('KitchenWasteForm')} fullWidth />}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {s.logError.message ? <InlineNotice message={s.logError.message} /> : null}

      {/* Bachat Box first: in the evening it is the thing to do now. */}
      <SectionHead title={BACHAT_BOX} action={s.boxes.length ? { label: 'Make another', onPress: () => navigation.navigate('KitchenBoxForm', { suggest: true }) } : undefined} />
      {s.suggestion && !s.boxes.length ? (
        <Card>
          <View style={styles.gap}>
            <AppText variant="overline" tone="accentDeep">
              Suggested for tonight
            </AppText>
            <AppText variant="title">{s.suggestion.title}</AppText>
            <AppText variant="small" tone="muted">
              {`${s.suggestion.quantity} boxes of ${s.suggestion.contentsHint.toLowerCase()} · ${formatPKR(s.suggestion.price)} instead of ${formatPKR(s.suggestion.value)} (${discountLabel(s.suggestion.value, s.suggestion.price)})`}
            </AppText>
            <TextAction label="Check and put it up" onPress={() => navigation.navigate('KitchenBoxForm', { suggest: true })} />
          </View>
        </Card>
      ) : null}
      {s.boxes.map(b => (
        <RowCard
          key={b.id}
          title={b.title}
          mark={{ icon: 'gift-outline', tint: 'rose' }}
          lines={[`Pickup ${b.pickupLabel}`, `${b.reserved} of ${b.quantity} reserved${b.collected ? ` · ${b.collected} collected` : ''}`]}
          pill={{ label: BOX_STATUS[b.status].label, tone: BOX_STATUS[b.status].tone }}
          amount={formatPKR(b.price)}
          onPress={() => navigation.navigate('KitchenBox', { id: b.id })}
        />
      ))}
      {!s.boxes.length && !s.suggestion && s.status === 'succeeded' ? (
        <Card>
          <View style={styles.gap}>
            <AppText variant="body">Food left at the end of the day? Sell it as a Bachat Box at a lower price, for pickup tonight.</AppText>
            <TextAction label="Make a Bachat Box" icon="add" onPress={() => navigation.navigate('KitchenBoxForm')} />
          </View>
        </Card>
      ) : null}
      {s.boxes.length ? (
        <Card>
          <View style={styles.gap}>
            <AppText variant="title">Collect by code</AppText>
            <View style={styles.code}>
              <View style={styles.codeField}>
                <TextField
                  label="The customer’s pickup code"
                  value={s.code}
                  onChangeText={t => dispatch(setPickupCode(t))}
                  autoCapitalize="characters"
                  placeholder="BB-7KQ2PX"
                  error={s.collectError.message || undefined}
                  returnKeyType="done"
                  onSubmitEditing={() => isPickupCode(s.code) && void collect()}
                />
              </View>
            </View>
            <Button label="Collect" variant="secondary" disabled={!isPickupCode(s.code)} loading={s.collecting} onPress={() => void collect()} fullWidth />
          </View>
        </Card>
      ) : null}

      {/* Waste */}
      <SectionHead title="Waste" />
      <SegmentTabs options={RANGES} value={s.range} onChange={r => dispatch(setWasteRange(r))} accessibilityLabel="Waste over" />
      {!w ? (
        s.status === 'failed' ? null : <SkeletonLines lines={6} />
      ) : (
        <>
          <AppText variant="body">{wasteSentence(w)}</AppText>
          {w.entries ? (
            <Card>
              <View style={styles.gap}>
                <AppText variant="overline" tone="muted">
                  By reason
                </AppText>
                {w.topReasons.map(r => (
                  <View key={r.reason} style={styles.row}>
                    <AppText variant="body" style={styles.grow}>
                      {WASTE_REASON_LABEL[r.reason]}
                    </AppText>
                    <AppText variant="bodyStrong">{formatPKR(r.cost)}</AppText>
                  </View>
                ))}
                {w.topItems.length ? <Divider /> : null}
                {w.topItems.length ? (
                  <AppText variant="overline" tone="muted">
                    Most wasted
                  </AppText>
                ) : null}
                {w.topItems.map(i => (
                  <View key={i.name} style={styles.row}>
                    <AppText variant="body" style={styles.grow} numberOfLines={1}>
                      {i.name}
                    </AppText>
                    <AppText variant="bodyStrong">{formatPKR(i.cost)}</AppText>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}
          {s.recent.map(e => (
            <RowCard
              key={e.id}
              title={e.lines.map(l => l.name).slice(0, 2).join(', ') + (e.lines.length > 2 ? ` and ${e.lines.length - 2} more` : '')}
              mark={{ icon: 'trash-outline', tint: 'grey' }}
              lines={[formatWhen(e.at, TZ), [...new Set(e.lines.map(l => WASTE_REASON_LABEL[l.reason]))].join(', '), e.note]}
              amount={formatPKR(e.cost)}
            />
          ))}
        </>
      )}

      {/* Rescued */}
      <SectionHead title="Meals rescued" action={{ label: 'Donations', onPress: () => navigation.navigate('KitchenDonations') }} />
      <StatGrid
        stats={[
          { key: 'total', icon: 'heart-outline', tint: 'rose', value: w ? rescued : null, label: 'Meals rescued', hint: 'Bachat Box pickups and donations' },
          { key: 'range', icon: 'calendar-outline', tint: 'blue', value: w ? w.mealsRescued.inRange : null, label: s.range === '7d' ? 'This week' : 'Last 30 days' },
        ]}
      />
      {rescued > 0 ? (
        <Button
          label="Share what you rescued"
          variant="secondary"
          leftIcon="share-outline"
          onPress={() =>
            void shareText(rescuedShareText(kitchen, rescued), 'Meals rescued').then(o => {
              if (o === 'copied') Toast.show({ type: 'success', text1: 'Copied', text2: 'Paste it into your status or a message.' });
            })
          }
          fullWidth
        />
      ) : null}
    </ScreenShell>
  );
};

export default WasteAndSurplusScreen;
