// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: plan a dawat
// ═══════════════════════════════════════════════════════
// Ask a kitchen to cater an event: what it is, the day and time, how many
// guests, the dishes (from its menu, or named) and how much of each, a
// budget if you have one, whether it is delivered, collected or cooked on
// site, where, and anything else. The kitchen answers with a quote.

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector, useAppStore } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { CATERING_MODE, EVENT_TYPES, EVENT_TYPE_LABEL } from '../../models/kitchen/kitchenStatusModel';
import { EVENT_TIMES, cateringInput, eventDates, timeLabel, validateCatering } from '../../models/kitchen/cateringModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, BottomSheetPicker, Button, Card, ChoiceChip, DateStrip, Divider, EmptyState, IconButton, InlineNotice, ScreenShell, SkeletonLines, TextAction, TextField } from '../../Custom-Components/index';
import { ChoiceLine } from '../../Custom-Components/food/ChoiceLine';
import type { FoodAppParamList } from '../../models';
import { formatDayChip } from '../../utils/health-time/healthTime';
import { formatPKR } from '../../utils/money/money';
import { haptics } from '../../utils/haptics/haptics';
import { loadAddressesAsync, selectAddressBook } from '../address-book-screen/addressBookSlice';
import {
  addCateringDish,
  editCatering,
  editCateringDish,
  loadCateringVendorAsync,
  removeCateringDish,
  selectFoodCateringForm,
  sendCateringAsync,
  setCateringErrors,
} from './foodCateringFormSlice';

type Props = NativeStackScreenProps<FoodAppParamList, 'FoodCateringForm'>;

const makeStyles = ({ space, size, radius, colors, type }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    dish: { flexDirection: 'row', alignItems: 'center', gap: space.s8, paddingVertical: space.s8 },
    name: { flex: 1, flexBasis: 0, minWidth: 0 },
    qty: {
      ...type.input,
      width: size.control.lg * 2,
      minHeight: size.control.sm,
      paddingHorizontal: space.s12,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      color: colors.ink,
      textAlign: 'right',
    },
    adds: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s16 },
  });

const FoodCateringForm: React.FC<Props> = props => (
  <ServiceScope service="food">
    <FoodCateringFormContent {...props} />
  </ServiceScope>
);

const FoodCateringFormContent: React.FC<Props> = ({ navigation, route }) => {
  const { slug, name } = route.params;
  const { back } = useBack({ name: 'FoodVendor', params: { slug } });
  const dispatch = useAppDispatch();
  const appStore = useAppStore();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const s = useAppSelector(selectFoodCateringForm);
  const book = useAppSelector(selectAddressBook);
  const [picker, setPicker] = useState<'time' | 'dish' | null>(null);
  const f = s.form;
  const v = s.slug === slug ? s.vendor : null;

  useEffect(() => {
    void dispatch(loadCateringVendorAsync(slug));
    void dispatch(loadAddressesAsync());
  }, [dispatch, slug]);
  useEffect(() => {
    if (!f.addressId && book.addresses.length) dispatch(editCatering({ addressId: (book.addresses.find(a => a.isDefault) ?? book.addresses[0]).id }));
  }, [dispatch, f.addressId, book.addresses]);
  const dates = useMemo(() => (v ? eventDates(v) : []), [v]);

  if (!v) {
    return (
      <ScreenShell title="Plan a dawat" subtitle={name} onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadCateringVendorAsync(slug)) }} /> : <SkeletonLines lines={10} />}
      </ScreenShell>
    );
  }
  if (!v.open) {
    return (
      <ScreenShell title="Plan a dawat" subtitle={name} onBack={back}>
        <EmptyState icon="calendar" title="Not taking catering requests" body="This kitchen isn’t taking dawat requests right now. Try another, or ask it when it opens them again." />
      </ScreenShell>
    );
  }

  const send = async () => {
    const errors = validateCatering(f, v);
    if (Object.keys(errors).length) {
      dispatch(setCateringErrors(errors));
      haptics.warning();
      return;
    }
    const r = await dispatch(sendCateringAsync(cateringInput(f, v.vendorId)));
    const sent = sendCateringAsync.fulfilled.match(r) ? selectFoodCateringForm(appStore.getState()).sent : null;
    if (sent) {
      haptics.success();
      navigation.replace('FoodCateringRequest', { code: sent.code, fresh: true });
    } else haptics.warning();
  };

  const priceOf = (itemId: string | null) => v.menu.find(m => m.itemId === itemId)?.price ?? null;
  const rough = f.dishes.reduce((n, d) => n + (priceOf(d.itemId) ?? 0) * (Number(d.qty) || 0), 0);

  return (
    <ScreenShell
      title="Plan a dawat"
      subtitle={name ?? 'Catering from this kitchen'}
      onBack={back}
      footer={<Button label="Send the request" onPress={() => void send()} loading={s.sending} fullWidth />}>
      {s.sendError.message ? <InlineNotice message={s.sendError.message} /> : null}

      <AppText variant="sectionTitle">What’s the occasion</AppText>
      <View style={styles.chips}>
        {EVENT_TYPES.map(t => (
          <ChoiceChip key={t} label={EVENT_TYPE_LABEL[t]} selected={f.eventType === t} onPress={() => dispatch(editCatering({ eventType: t }))} />
        ))}
      </View>

      <AppText variant="sectionTitle">When</AppText>
      <DateStrip
        days={dates.map(date => ({ date, slotCount: 1 }))}
        selected={f.date}
        onSelect={date => dispatch(editCatering({ date }))}
        describe={d => ({ sub: formatDayChip(d.date).month, label: formatDayChip(d.date).long })}
      />
      {s.errors.date ? (
        <AppText variant="small" tone="danger">
          {s.errors.date}
        </AppText>
      ) : (
        <AppText variant="caption" tone="muted">
          {`At least ${v.leadDays} days ahead.`}
        </AppText>
      )}
      <Button label={`At ${timeLabel(f.time)}`} variant="secondary" leftIcon="time-outline" onPress={() => setPicker('time')} />

      <TextField
        label="Guests"
        value={f.guests}
        onChangeText={guests => dispatch(editCatering({ guests }))}
        keyboardType="number-pad"
        placeholder={String(Math.max(v.minGuests, 50))}
        helper={`From ${v.minGuests} guests`}
        error={s.errors.guests}
      />

      <AppText variant="sectionTitle">Dishes</AppText>
      {f.dishes.length ? (
        <Card padded="horizontal">
          {f.dishes.map((d, n) => (
            <View key={d.key}>
              {n > 0 ? <Divider /> : null}
              <View style={styles.dish}>
                {d.itemId ? (
                  <View style={styles.name}>
                    <AppText variant="bodyStrong">{d.name}</AppText>
                    {priceOf(d.itemId) ? (
                      <AppText variant="caption" tone="muted">
                        {`${formatPKR(priceOf(d.itemId)!)} on the menu`}
                      </AppText>
                    ) : null}
                  </View>
                ) : (
                  <TextInput
                    value={d.name}
                    onChangeText={t => dispatch(editCateringDish({ key: d.key, patch: { name: t } }))}
                    placeholder="Dish name"
                    placeholderTextColor={colors.inkFaint}
                    style={[styles.qty, styles.name, { textAlign: 'left' }]}
                    accessibilityLabel="Dish name"
                  />
                )}
                <TextInput
                  value={d.qty}
                  onChangeText={qty => dispatch(editCateringDish({ key: d.key, patch: { qty } }))}
                  keyboardType="number-pad"
                  placeholder="How many"
                  placeholderTextColor={colors.inkFaint}
                  style={styles.qty}
                  accessibilityLabel={`${d.name || 'Dish'}: how many`}
                />
                <IconButton icon="close" tone="muted" onPress={() => dispatch(removeCateringDish(d.key))} accessibilityLabel={`Remove ${d.name || 'this dish'}`} />
              </View>
            </View>
          ))}
        </Card>
      ) : null}
      {s.errors.dishes ? <InlineNotice message={s.errors.dishes} /> : null}
      <View style={styles.adds}>
        <TextAction label="Add from the menu" icon="add" onPress={() => setPicker('dish')} />
        <TextAction label="Something not on it" icon="add" onPress={() => dispatch(addCateringDish({ itemId: null, name: '' }))} />
      </View>
      {rough ? (
        <AppText variant="small" tone="muted">
          {`About ${formatPKR(rough)} at menu prices. The kitchen’s quote may differ for a large order.`}
        </AppText>
      ) : null}

      <TextField label="Budget (optional, Rs)" value={f.budget} onChangeText={budget => dispatch(editCatering({ budget }))} keyboardType="number-pad" placeholder="50000" error={s.errors.budget} />

      <View style={styles.gap}>
        <AppText variant="sectionTitle">How it’s served</AppText>
        {v.modes.map(m => (
          <ChoiceLine key={m} label={CATERING_MODE[m].label} note={CATERING_MODE[m].hint} price={null} selected={f.mode === m} multiple={false} onPress={() => dispatch(editCatering({ mode: m }))} />
        ))}
      </View>

      {f.mode !== 'pickup' ? (
        <View style={styles.gap}>
          <AppText variant="sectionTitle">Where</AppText>
          {book.addresses.map(a => (
            <ChoiceLine
              key={a.id}
              label={a.label === 'work' ? 'Work' : a.label === 'home' ? 'Home' : 'Other'}
              note={[a.line1, a.area].filter(Boolean).join(', ')}
              price={null}
              selected={f.addressId === a.id}
              multiple={false}
              onPress={() => dispatch(editCatering({ addressId: a.id }))}
            />
          ))}
          {s.errors.addressId ? (
            <AppText variant="small" tone="danger">
              {s.errors.addressId}
            </AppText>
          ) : null}
          <TextAction label="Add an address" icon="add" onPress={() => navigation.getParent()?.navigate('AddressForm')} />
        </View>
      ) : null}

      <TextField label="Anything else (optional)" value={f.notes} onChangeText={notes => dispatch(editCatering({ notes }))} placeholder="Serving staff, plates, a dish for children…" maxLength={500} multiline />
      <AppText variant="caption" tone="muted">
        The kitchen sends a quote you can accept. You pay it directly; MetroMatrix takes no commission.
      </AppText>

      <BottomSheetPicker
        visible={picker === 'time'}
        onClose={() => setPicker(null)}
        title="What time"
        options={EVENT_TIMES.map(t => ({ value: t, label: timeLabel(t) }))}
        value={f.time}
        onSelect={time => {
          dispatch(editCatering({ time }));
          setPicker(null);
        }}
      />
      <BottomSheetPicker
        visible={picker === 'dish'}
        onClose={() => setPicker(null)}
        title="Add from the menu"
        options={v.menu.filter(m => !f.dishes.some(d => d.itemId === m.itemId)).map(m => ({ value: m.itemId, label: `${m.name} · ${formatPKR(m.price)}` }))}
        value={null}
        onSelect={itemId => {
          const m = v.menu.find(x => x.itemId === itemId);
          if (m) dispatch(addCateringDish({ itemId: m.itemId, name: m.name }));
          setPicker(null);
        }}
      />
    </ScreenShell>
  );
};

export default FoodCateringForm;
