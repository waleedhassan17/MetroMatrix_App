// ═══════════════════════════════════════════════════════
// MetroMatrix — Add or edit a delivery address
// ═══════════════════════════════════════════════════════
// Who receives it, a mobile number the rider can call, the city (stores
// deliver to some cities only), the area and the street. "Use my location"
// pins it (and on a phone suggests the city and street).

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { ADDRESS_LABELS, emptyAddressForm, fromAddress, validateAddressForm, type AddressForm } from '@models/addressModel';
import { hasErrors } from '@models/authModel';
import { CITIES } from '@models/businessModel';
import { useStyles, type Theme } from '@theme/index';
import {
  BottomSheetPicker,
  Button,
  ChoiceChip,
  InlineNotice,
  PickerField,
  ScreenShell,
  TextAction,
  TextField,
  ToggleRow,
} from '@custom/index';
import type { ShopBrowseParamList } from '@/types';
import { visibleErrors } from '@utils/formErrors';
import { haptics } from '@utils/haptics';
import { selectUser } from '../../Auth/authSlice';
import { selectAddressBook } from '../AddressBook/addressBookSlice';
import {
  locateAddressAsync,
  saveAddressAsync,
  selectAddressForm,
  setAddressField,
  startAddressForm,
  touchAddressField,
} from './addressFormSlice';

type Props = NativeStackScreenProps<ShopBrowseParamList, 'AddressForm'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', gap: space.s8 },
  });

const AddressFormScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const user = useAppSelector(selectUser);
  const book = useAppSelector(selectAddressBook);
  const s = useAppSelector(selectAddressForm);
  const [cityOpen, setCityOpen] = useState(false);
  const id = route.params?.id ?? null;

  useEffect(() => {
    const existing = id ? book.addresses.find(a => a.id === id) : null;
    dispatch(
      startAddressForm({
        id,
        form: existing ? fromAddress(existing) : { ...emptyAddressForm({ name: user?.name, phone: user?.phone, city: user?.city }), isDefault: !book.addresses.length },
      }),
    );
    // The form starts once, from the book as it was when the screen opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, id]);

  const f = s.form;
  const errors = validateAddressForm(f);
  const shown = visibleErrors(errors, s.touched, s.submitted);
  const set = <K extends keyof AddressForm>(field: K, value: AddressForm[K]) => dispatch(setAddressField({ field, value }));
  const touch = (field: keyof AddressForm) => dispatch(touchAddressField(field));

  const save = async () => {
    if (hasErrors(errors)) {
      for (const k of Object.keys(errors) as (keyof AddressForm)[]) touch(k);
      haptics.warning();
      return;
    }
    const r = await dispatch(saveAddressAsync({ id: s.editingId, form: f }));
    if (saveAddressAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: id ? 'Address updated' : 'Address added' });
      navigation.goBack();
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title={id ? 'Edit address' : 'New address'}
      onBack={() => navigation.goBack()}
      footer={<Button label="Save address" onPress={() => void save()} loading={s.status === 'loading'} fullWidth />}>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Address label">
        {ADDRESS_LABELS.map(l => (
          <ChoiceChip key={l.key} label={l.label} icon={l.icon} selected={f.label === l.key} onPress={() => set('label', l.key)} />
        ))}
      </View>
      <TextField
        label="Full name"
        value={f.fullName}
        onChangeText={v => set('fullName', v)}
        onBlur={() => touch('fullName')}
        error={shown.fullName}
        autoComplete="name"
        autoCapitalize="words"
      />
      <TextField
        label="Mobile number"
        mode="phone"
        value={f.phone}
        onChangeText={v => set('phone', v)}
        onBlur={() => touch('phone')}
        error={shown.phone}
        helper="The rider calls this number."
        placeholder="312 3456789"
      />
      <PickerField label="City" valueLabel={f.city || null} placeholder="Choose a city" onPress={() => setCityOpen(true)} error={shown.city} />
      <TextField
        label="Area or block"
        value={f.area}
        onChangeText={v => set('area', v)}
        onBlur={() => touch('area')}
        error={shown.area}
        placeholder="Gulberg III"
      />
      <TextField
        label="House, street and block"
        value={f.line1}
        onChangeText={v => set('line1', v)}
        onBlur={() => touch('line1')}
        error={shown.line1}
        placeholder="House 12, Street 4"
        autoComplete="street-address"
      />
      <TextField label="Landmark (optional)" value={f.landmark} onChangeText={v => set('landmark', v)} placeholder="Near the mosque" />
      <TextAction
        label={s.locating ? 'Finding you…' : f.lat !== null ? 'Location pinned. Update it' : 'Use my current location'}
        icon="locate-outline"
        onPress={() => void dispatch(locateAddressAsync())}
        disabled={s.locating}
      />
      <ToggleRow label="Make this my default" value={f.isDefault} onChange={v => set('isDefault', v)} />

      <BottomSheetPicker
        visible={cityOpen}
        onClose={() => setCityOpen(false)}
        title="Choose a city"
        options={CITIES}
        value={f.city || null}
        onSelect={v => {
          set('city', v);
          touch('city');
          setCityOpen(false);
        }}
      />
    </ScreenShell>
  );
};

export default AddressFormScreen;
