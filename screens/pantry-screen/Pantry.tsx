// ═══════════════════════════════════════════════════════
// MetroMatrix — My Kitchen: what's in your kitchen
// ═══════════════════════════════════════════════════════
// The customer's own pantry: All, Use soon, Expired. Each thing with how
// much and when to use it by; swipe or tap to mark it used, or remove it.
// Add by a short form, by speaking ("do kilo aloo, expiry agle hafte": a
// draft to confirm), or from a Shopping order's groceries. Reminders the
// morning things are about to expire, and the month's "saved from waste".
// Then: cook something from it. Nobody else sees any of this.

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { EXPIRY_CHOICES, PANTRY_SEGMENTS, PANTRY_UNITS, expiryLine, pantryLineOf, pantryQty, statsLine, validatePantryForm } from '../../models/myKitchen/pantryModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, Checkbox, ChoiceChip, Divider, EmptyState, InlineNotice, PantryItemRow, ScreenShell, SegmentTabs, Sheet, SkeletonLines, TextAction, TextField, ToggleRow } from '../../Custom-Components/index';
import { VoiceEntry } from '../../Components/voice/VoiceEntry';
import { IconWell } from '../../Components/admin/AdminParts';
import type { FoodAppParamList, VoiceAction } from '../../models';
import { formatDayShort, todayInZone } from '../../utils/health-time/healthTime';
import { formatQty } from '../../utils/units/units';
import { haptics } from '../../utils/haptics/haptics';
import {
  addFromOrderAsync,
  addPantryAsync,
  loadGroceryOrdersAsync,
  loadPantryAsync,
  markUsedAsync,
  openPantryForm,
  saveRemindersAsync,
  selectPantry,
  setPantryField,
  setPantrySegment,
  throwAwayAsync,
} from './pantrySlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'MyKitchen'>;

const TZ = 'Asia/Karachi';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    tight: { gap: space.s4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    two: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1, flexBasis: 0, minWidth: 0 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, minWidth: 0, gap: space.s4 },
    line: { paddingVertical: space.s8 },
  });

const Pantry: React.FC<Props> = props => (
  <ServiceScope service="food">
    <PantryContent {...props} />
  </ServiceScope>
);

const PantryContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'FoodTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectPantry);
  const today = useMemo(() => todayInZone(TZ), []);
  const [sheet, setSheet] = useState<'voice' | 'orders' | 'reminders' | null>(null);
  const [picked, setPicked] = useState<Record<string, string[]>>({});

  const load = useCallback(() => void dispatch(loadPantryAsync(s.segment)), [dispatch, s.segment]);
  useFocusEffect(load);

  const errors = validatePantryForm(s.form);
  const items = s.list?.items ?? [];

  const add = async () => {
    if (Object.keys(errors).length) return;
    haptics.press();
    const r = await dispatch(addPantryAsync({ lines: [pantryLineOf(s.form, today)], source: 'manual' }));
    if (addPantryAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: `${r.payload[0]?.name ?? 'It'} added` });
      load();
    } else haptics.warning();
  };

  /** A voice draft, confirmed: the same add. */
  const confirmVoice = async (a: VoiceAction) => {
    if (a.kind !== 'pantry.add') return false;
    const r = await dispatch(addPantryAsync({ lines: a.lines.map(l => ({ name: l.name, key: l.key, qty: l.qty, unit: l.unit, expiresOn: l.expiresOn })), source: 'voice' }));
    if (addPantryAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: `${r.payload.length} ${r.payload.length === 1 ? 'thing' : 'things'} added` });
      setSheet(null);
      load();
      return true;
    }
    haptics.warning();
    return false;
  };

  const markUsed = async (id: string, name: string) => {
    const r = await dispatch(markUsedAsync(id));
    if (markUsedAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: `${name} used`, text2: r.payload.savedFromWaste ? 'Saved from waste.' : undefined });
      load();
    }
  };
  const remove = async (id: string, name: string) => {
    const r = await dispatch(throwAwayAsync(id));
    if (throwAwayAsync.fulfilled.match(r)) {
      Toast.show({ type: 'success', text1: `${name} removed` });
      load();
    }
  };

  const openOrders = () => {
    setSheet('orders');
    void dispatch(loadGroceryOrdersAsync());
  };
  const addFromOrder = async (orderId: string, lineIds: string[]) => {
    const r = await dispatch(addFromOrderAsync({ orderId, lineIds }));
    if (addFromOrderAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: `${r.payload.length} ${r.payload.length === 1 ? 'thing' : 'things'} added from your order` });
      setSheet(null);
      load();
    }
  };

  return (
    <ScreenShell title="My Kitchen" subtitle="What’s in your kitchen at home" onBack={back} refreshing={s.status === 'loading' && !!s.list} onRefresh={load}>
      {s.status === 'failed' && !s.list ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {s.actionError.message ? <InlineNotice message={s.actionError.message} /> : null}

      {s.stats ? (
        <Card>
          <View style={styles.head}>
            <IconWell icon="leaf-outline" tint="blue" />
            <View style={styles.grow}>
              <AppText variant="title">{statsLine(s.stats)}</AppText>
              <AppText variant="small" tone="muted">
                {`${s.stats.inKitchen} ${s.stats.inKitchen === 1 ? 'thing' : 'things'} in your kitchen`}
              </AppText>
            </View>
          </View>
        </Card>
      ) : null}

      <Button label="Cook something from it" leftIcon="restaurant-outline" onPress={() => navigation.navigate('MyKitchenRecipes')} fullWidth />
      <View style={styles.two}>
        <View style={styles.half}>
          <Button label="Add" variant="secondary" leftIcon="add-outline" onPress={() => dispatch(openPantryForm(true))} fullWidth />
        </View>
        <View style={styles.half}>
          <Button label="Speak" variant="secondary" leftIcon="mic-outline" onPress={() => setSheet('voice')} fullWidth />
        </View>
      </View>
      <View style={styles.chips}>
        <TextAction label="Add from a Shopping order" icon="bag-handle-outline" onPress={openOrders} />
        <TextAction label="Reminders" icon="notifications-outline" onPress={() => setSheet('reminders')} />
      </View>

      <SegmentTabs
        options={PANTRY_SEGMENTS.map(x => ({ key: x.key, label: s.list ? `${x.label} · ${s.list.counts[x.key]}` : x.label }))}
        value={s.segment}
        onChange={k => dispatch(setPantrySegment(k as typeof s.segment))}
        accessibilityLabel="Your kitchen"
      />
      {!s.list && s.status !== 'failed' ? <SkeletonLines lines={6} /> : null}
      {s.list && !items.length ? (
        <EmptyState
          icon="archive"
          title={s.segment === 'all' ? 'Nothing here yet' : s.segment === 'use_soon' ? 'Nothing to use soon' : 'Nothing expired'}
          body={s.segment === 'all' ? 'Add what you have, and you’ll get ideas to cook it before it goes off.' : 'All good for now.'}
        />
      ) : null}
      {items.length ? (
        <Card padded={false}>
          {items.map((p, n) => (
            <View key={p.id}>
              {n ? <Divider /> : null}
              <PantryItemRow name={p.name} qtyLabel={`${pantryQty(p)} · ${expiryLine(p)}`} expiresOn={p.expiresOn} today={today} onUse={() => void markUsed(p.id, p.name)} onRemove={() => void remove(p.id, p.name)} />
            </View>
          ))}
        </Card>
      ) : null}
      {items.length ? (
        <AppText variant="caption" tone="muted">
          Swipe right when you’ve used something, left to remove it. Only you see your kitchen.
        </AppText>
      ) : null}

      {/* Add by hand */}
      <Sheet
        visible={s.formOpen}
        onClose={() => dispatch(openPantryForm(false))}
        title="Add to your kitchen"
        footer={<Button label="Add it" loading={s.saving} disabled={Object.keys(errors).length > 0} onPress={() => void add()} fullWidth />}>
        <View style={styles.gap}>
          <TextField label="What" value={s.form.name} onChangeText={v => dispatch(setPantryField({ name: v }))} placeholder="Potatoes, dahi, anday" autoFocus />
          <TextField label="How much" mode="numeric" value={s.form.qty} onChangeText={v => dispatch(setPantryField({ qty: v }))} placeholder="2" />
          <View style={styles.chips}>
            {PANTRY_UNITS.map(u => (
              <ChoiceChip key={u} label={u === 'pao' ? 'pao' : u === 'pc' ? 'pieces' : u} selected={s.form.unit === u} onPress={() => dispatch(setPantryField({ unit: u }))} />
            ))}
          </View>
          <AppText variant="label">Use by</AppText>
          <View style={styles.chips}>
            {EXPIRY_CHOICES.map(c => (
              <ChoiceChip key={c.label} label={c.label} selected={s.form.expiresIn === c.days} onPress={() => dispatch(setPantryField({ expiresIn: c.days }))} />
            ))}
          </View>
        </View>
      </Sheet>

      {/* Speak */}
      <Sheet visible={sheet === 'voice'} onClose={() => setSheet(null)} title="Say what you have" subtitle="In Urdu or English. You check it before it’s added.">
        <VoiceEntry context="pantry" onConfirm={confirmVoice} busy={s.saving} />
      </Sheet>

      {/* From a Shopping order */}
      <Sheet visible={sheet === 'orders'} onClose={() => setSheet(null)} title="Add from a Shopping order" subtitle="Groceries from your orders in the last 45 days">
        <View style={styles.gap}>
          {s.ordersStatus === 'loading' && !s.orders.length ? <SkeletonLines lines={4} /> : null}
          {s.ordersStatus === 'succeeded' && !s.orders.length ? (
            <AppText variant="body" tone="muted">
              No grocery orders yet. Groceries you order on MetroMatrix Shopping show here.
            </AppText>
          ) : null}
          {s.orders.map(o => {
            const chosen = picked[o.orderId] ?? o.lines.filter(l => !l.alreadyAdded).map(l => l.lineId);
            return (
              <Card key={o.orderId}>
                <View style={styles.gap}>
                  <View style={styles.tight}>
                    <AppText variant="title">{`${o.storeName} · ${o.code}`}</AppText>
                    <AppText variant="small" tone="muted">
                      {formatDayShort(o.placedAt.slice(0, 10))}
                    </AppText>
                  </View>
                  {o.lines.map(l => (
                    <View key={l.lineId} style={styles.line}>
                      <Checkbox
                        checked={chosen.includes(l.lineId)}
                        onToggle={on => setPicked({ ...picked, [o.orderId]: on ? [...chosen, l.lineId] : chosen.filter(x => x !== l.lineId) })}
                        label={`${l.name} × ${l.quantity}${l.alreadyAdded ? ' (added before)' : ''}`}
                        accessibilityLabel={`${l.name}, ${formatQty(l.netQuantity.qty * l.quantity, l.netQuantity.unit)}`}
                      />
                    </View>
                  ))}
                  <Button label={`Add ${chosen.length} to my kitchen`} disabled={!chosen.length} loading={s.acting === o.orderId} onPress={() => void addFromOrder(o.orderId, chosen)} fullWidth />
                </View>
              </Card>
            );
          })}
        </View>
      </Sheet>

      {/* Reminders */}
      <Sheet visible={sheet === 'reminders'} onClose={() => setSheet(null)} title="Reminders" subtitle="A note the morning things are about to expire">
        {s.reminders ? (
          <View style={styles.gap}>
            <ToggleRow label="Remind me" value={s.reminders.enabled} onChange={v => void dispatch(saveRemindersAsync({ enabled: v }))} />
            <AppText variant="label">How early</AppText>
            <View style={styles.chips}>
              {[0, 1, 2, 3].map(d => (
                <ChoiceChip key={d} label={d === 0 ? 'On the day' : d === 1 ? 'A day before' : `${d} days before`} selected={s.reminders!.daysBefore === d} disabled={!s.reminders!.enabled} onPress={() => void dispatch(saveRemindersAsync({ daysBefore: d }))} />
              ))}
            </View>
            <AppText variant="small" tone="muted">
              {`At ${s.reminders.time}, as a notification.`}
            </AppText>
          </View>
        ) : (
          <SkeletonLines lines={3} />
        )}
      </Sheet>
    </ScreenShell>
  );
};

export default Pantry;
