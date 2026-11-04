// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: one deal (new or edit)
// ═══════════════════════════════════════════════════════
// What it gives, above what order, with or without a code, on which days
// and hours, until when and how often — with the label customers will see
// updating as it's typed. A deal nobody has used can be deleted; a used one
// is switched off instead (orders keep what it gave them).

import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { PROMOTION_KINDS, PROMOTION_STATE, WEEKDAY_CHOICES, formLabel, validatePromotion } from '../../models/food/promotionModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Checkbox, ChoiceChip, DateField, InlineNotice, ScreenShell, SkeletonLines, StatusPill, TextField, ToggleRow, SectionCard, TimeField, DangerRow } from '../../Custom-Components/index';
import { DealTag, TrustNote } from '../../Components/food/FoodParts';
import { ChoiceLine } from '../../Custom-Components/food/ChoiceLine';
import type { FoodVendorStackParamList } from '../../models';
import { Alert } from '../../utils/alert/alert';
import { haptics } from '../../utils/haptics/haptics';
import { PKT, todayInZone } from '../../utils/health-time/healthTime';
import {
  deactivatePromotionAsync,
  deletePromotionAsync,
  loadPromotionAsync,
  markPromotionSubmitted,
  savePromotionAsync,
  selectVendorPromotion,
  setPromotionFlag,
  setPromotionKind,
  setPromotionText,
  togglePromotionDay,
  togglePromotionDish,
} from './vendorPromotionSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorPromotion'>;

const makeStyles = ({ space, size }: Theme) =>
  StyleSheet.create({
    preview: { alignSelf: 'flex-start' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    pair: { flexDirection: 'row', gap: space.s12 },
    half: { flex: 1 },
    // Scrolls inside its card, so a long menu neither clips nor pushes the form away.
    dishes: { maxHeight: size.pickerList },
    dishList: { gap: space.s4 },
    actions: { gap: space.s8 },
  });

const VendorPromotion: React.FC<Props> = props => (
  <ServiceScope service="food">
    <VendorPromotionContent {...props} />
  </ServiceScope>
);

const VendorPromotionContent: React.FC<Props> = ({ route }) => {
  const id = route.params?.id;
  const { back } = useBack({ name: 'VendorPromotions' });
  const dispatch = useAppDispatch();
  const appStore = useAppStore();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorPromotion);
  const f = s.form;

  useEffect(() => {
    void dispatch(loadPromotionAsync(id));
  }, [dispatch, id]);

  const title = id ? 'Edit deal' : 'New deal';
  if (!f || s.status === 'loading') {
    return (
      <ScreenShell title={title} onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadPromotionAsync(id)) }} /> : <SkeletonLines lines={10} />}
      </ScreenShell>
    );
  }

  const today = todayInZone(PKT);
  const errors = s.submitted ? validatePromotion(f, today) : {};
  const p = s.promotion;
  const percent = f.kind === 'percent_off_order' || f.kind === 'percent_off_items';
  const text = (field: Parameters<typeof setPromotionText>[0]['field']) => (value: string) => dispatch(setPromotionText({ field, value }));

  const save = async () => {
    dispatch(markPromotionSubmitted());
    if (Object.keys(validatePromotion(f, today)).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(savePromotionAsync());
    if (savePromotionAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: id ? 'Deal saved' : 'Deal added', text2: selectVendorPromotion(appStore.getState()).promotion?.state === 'live' ? 'Customers can see it now.' : undefined });
      back();
    } else haptics.warning();
  };

  const remove = () =>
    Alert.alert(`Delete ${f.title || 'this deal'}?`, 'Customers stop seeing it straight away.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const r = await dispatch(deletePromotionAsync(id!));
          if (deletePromotionAsync.fulfilled.match(r)) {
            Toast.show({ type: 'success', text1: 'Deal deleted' });
            back();
          }
        },
      },
    ]);

  return (
    <ScreenShell
      title={title}
      subtitle={p ? `${PROMOTION_STATE[p.state].label} · used on ${p.usedCount} ${p.usedCount === 1 ? 'order' : 'orders'}` : 'Your offer, on your card and menu'}
      onBack={back}
      footer={<Button label={id ? 'Save deal' : 'Add deal'} onPress={() => void save()} loading={s.saving} fullWidth />}
    >
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}

      <SectionCard title="Name" subtitle="Customers see the tag on your card and menu" icon="pricetag-outline" invalid={!!errors.title}>
        <View style={styles.preview}>
          <DealTag label={formLabel(f)} />
        </View>
        <TextField label="Name (only you see it)" value={f.title} onChangeText={text('title')} error={errors.title} maxLength={80} placeholder="Biryani nights" />
      </SectionCard>

      <SectionCard title="What it gives" icon="gift-outline" invalid={!!errors.value || !!errors.maxDiscount || !!errors.minOrder}>
        {PROMOTION_KINDS.map(k => (
          <ChoiceLine key={k.key} label={k.label} price={null} note={k.hint} selected={f.kind === k.key} multiple={false} onPress={() => dispatch(setPromotionKind(k.key))} />
        ))}
        {f.kind !== 'free_delivery' ? (
          <View style={styles.pair}>
            <View style={styles.half}>
              <TextField label={percent ? 'Percent off' : 'Rupees off'} value={f.value} onChangeText={text('value')} keyboardType="number-pad" error={errors.value} />
            </View>
            {percent ? (
              <View style={styles.half}>
                <TextField label="At most, Rs (optional)" value={f.maxDiscount} onChangeText={text('maxDiscount')} keyboardType="number-pad" error={errors.maxDiscount} />
              </View>
            ) : null}
          </View>
        ) : null}
        <TextField label="On orders of at least, Rs" value={f.minOrder} onChangeText={text('minOrder')} keyboardType="number-pad" error={errors.minOrder} />
      </SectionCard>

      {f.kind === 'percent_off_items' ? (
        <SectionCard title="Which dishes" subtitle={f.itemIds.length ? `${f.itemIds.length} chosen` : undefined} icon="restaurant-outline" invalid={!!errors.itemIds}>
          {errors.itemIds ? (
            <AppText variant="small" tone="danger">
              {errors.itemIds}
            </AppText>
          ) : null}
          <ScrollView style={styles.dishes} contentContainerStyle={styles.dishList} nestedScrollEnabled>
            {s.dishes.map(d => (
              <Checkbox key={d.id} checked={f.itemIds.includes(d.id)} onToggle={() => dispatch(togglePromotionDish(d.id))} label={d.name} accessibilityLabel={d.name} />
            ))}
          </ScrollView>
        </SectionCard>
      ) : null}

      <SectionCard title="Who gets it" icon="people-outline" invalid={!!errors.code || !!errors.usageLimit || !!errors.perUserLimit}>
        <ToggleRow
          label="Customers type a code"
          helper="Off: it applies by itself and shows on your card"
          value={f.withCode}
          onChange={v => dispatch(setPromotionFlag({ field: 'withCode', value: v }))}
        />
        {f.withCode ? <TextField label="Code" value={f.code} onChangeText={v => dispatch(setPromotionText({ field: 'code', value: v.toUpperCase() }))} autoCapitalize="characters" error={errors.code} maxLength={20} placeholder="BIRYANI100" /> : null}
        <ToggleRow label="First orders only" helper="Only customers who haven’t ordered from you yet" value={f.firstOrderOnly} onChange={v => dispatch(setPromotionFlag({ field: 'firstOrderOnly', value: v }))} />
        <View style={styles.pair}>
          <View style={styles.half}>
            <TextField label="Orders in all (optional)" value={f.usageLimit} onChangeText={text('usageLimit')} keyboardType="number-pad" error={errors.usageLimit} />
          </View>
          <View style={styles.half}>
            <TextField label="Per customer (optional)" value={f.perUserLimit} onChangeText={text('perUserLimit')} keyboardType="number-pad" error={errors.perUserLimit} />
          </View>
        </View>
      </SectionCard>

      <SectionCard title="When it runs" icon="calendar-outline" invalid={!!errors.weekdays || !!errors.timeTo || !!errors.endsOn}>
        <View style={styles.chips}>
          {WEEKDAY_CHOICES.map(d => (
            <ChoiceChip key={d.day} label={d.label} selected={f.weekdays.includes(d.day)} onPress={() => dispatch(togglePromotionDay(d.day))} />
          ))}
        </View>
        {errors.weekdays ? (
          <AppText variant="small" tone="danger">
            {errors.weekdays}
          </AppText>
        ) : null}
        <ToggleRow label="Only at certain hours" helper="A happy hour; it can run past midnight" value={f.withWindow} onChange={v => dispatch(setPromotionFlag({ field: 'withWindow', value: v }))} />
        {f.withWindow ? (
          <View style={styles.pair}>
            <View style={styles.half}>
              <TimeField label="From" value={f.timeFrom} onChange={text('timeFrom')} step={30} />
            </View>
            <View style={styles.half}>
              <TimeField label="Until" value={f.timeTo} onChange={text('timeTo')} step={30} allowMidnight error={errors.timeTo} />
            </View>
          </View>
        ) : null}
        <DateField label="Last day (optional)" value={f.endsOn} onChange={text('endsOn')} min={today} placeholder="No end date" error={errors.endsOn} />
      </SectionCard>

      {p ? (
        <View style={styles.actions}>
          {p.isActive ? (
            <Button label="Switch it off" variant="secondary" leftIcon="pause-circle-outline" loading={s.saving} onPress={() => void dispatch(deactivatePromotionAsync(p.id))} fullWidth />
          ) : (
            <StatusPill label="Off — customers don’t see it" tone="neutral" />
          )}
          {p.usedCount === 0 ? <DangerRow label="Delete deal" onConfirm={remove} /> : null}
        </View>
      ) : null}

      <TrustNote text="You fund every deal. Customers get one deal per order — the one that saves them most — and MetroMatrix takes no commission." />
    </ScreenShell>
  );
};

export default VendorPromotion;
