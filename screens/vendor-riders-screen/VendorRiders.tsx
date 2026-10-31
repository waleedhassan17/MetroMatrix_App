// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: Riders (tab)
// ═══════════════════════════════════════════════════════
// The vendor's own riders, with who is on duty and whose phone is reporting.
// Adding a rider issues a username and a password, shown once. Riders are
// optional: an order can also be marked as handed to the vendor's own rider.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { RIDER_VEHICLES, validateRider } from '../../models/food/vendorModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, ChoiceChip, Divider, EmptyState, InlineNotice, ScreenShell, Sheet, SkeletonLines, TextField } from '../../Custom-Components/index';
import { RiderPill } from '../../Custom-Components/food/RiderPill';
import { CredentialCard } from '../../Custom-Components/food/CredentialCard';
import { haptics } from '../../utils/haptics/haptics';
import {
  closeAddRider,
  createRiderAsync,
  loadRidersAsync,
  markRiderSubmitted,
  openAddRider,
  selectVendorRiders,
  setRiderField,
} from './vendorRidersSlice';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    form: { gap: space.s16 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

/** `onBack`: shown when Riders is a page (a home kitchen opens it from More), not a tab. */
const VendorRiders: React.FC<{ onBack?: () => void }> = ({ onBack }) => (
  <ServiceScope service="food">
    <VendorRidersContent onBack={onBack} />
  </ServiceScope>
);

const VendorRidersContent: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorRiders);
  const errors = s.submitted ? validateRider(s.form) : {};
  const onDuty = s.riders.filter(r => r.status === 'active' && r.onDuty).length;

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadRidersAsync());
    }, [dispatch]),
  );

  const add = async () => {
    dispatch(markRiderSubmitted());
    if (Object.keys(validateRider(s.form)).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(createRiderAsync(s.form));
    if (createRiderAsync.fulfilled.match(r)) haptics.success();
    else haptics.warning();
  };

  return (
    <ScreenShell
      title="Riders"
      onBack={onBack}
      subtitle={s.riders.length ? `${onDuty} of ${s.riders.length} on duty` : 'Your own delivery riders'}
      footer={<Button label="Add a rider" leftIcon="person-add-outline" onPress={() => dispatch(openAddRider())} fullWidth />}
      refreshing={s.status === 'loading' && !!s.riders.length}
      onRefresh={() => void dispatch(loadRidersAsync())}
    >
      <InlineNotice tone="info" message="Riders are optional — you can also mark an order as handed to your own rider." />
      {s.error.message && s.sheet === 'closed' ? <InlineNotice message={s.error.message} /> : null}
      {s.status === 'loading' && !s.riders.length ? (
        <SkeletonLines lines={5} />
      ) : !s.riders.length ? (
        <EmptyState icon="users" title="No riders yet" body="Add the people who deliver for you. Each gets a username and password for the MetroMatrix app, and you see them on the map while they deliver." />
      ) : (
        <Card padded="horizontal">
          {s.riders.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Divider /> : null}
              <RiderPill rider={r} onPress={() => navigation.navigate('VendorRiderDetail', { id: r.id })} />
            </View>
          ))}
        </Card>
      )}

      <Sheet
        visible={s.sheet !== 'closed'}
        onClose={() => dispatch(closeAddRider())}
        title={s.sheet === 'credential' ? `${s.created?.name ?? 'Rider'} is added` : 'Add a rider'}
        footer={
          s.sheet === 'credential' ? (
            <Button label="Done" variant="secondary" onPress={() => dispatch(closeAddRider())} fullWidth />
          ) : (
            <Button label="Add rider" onPress={() => void add()} loading={s.saving} fullWidth />
          )
        }
      >
        {s.sheet === 'credential' && s.created ? (
          <CredentialCard riderName={s.created.name} credential={s.created.credential} />
        ) : (
          <View style={styles.form}>
            <TextField label="Full name" value={s.form.fullName} onChangeText={v => dispatch(setRiderField({ field: 'fullName', value: v }))} error={errors.fullName} placeholder="Ali Raza" />
            <TextField
              label="Mobile (optional)"
              value={s.form.phone ?? ''}
              onChangeText={v => dispatch(setRiderField({ field: 'phone', value: v }))}
              error={errors.phone}
              keyboardType="phone-pad"
              placeholder="0300 1234567"
              helper="Customers can call the rider while they deliver."
            />
            <AppText variant="bodyStrong">Rides a</AppText>
            <View style={styles.chips}>
              {RIDER_VEHICLES.map(v => (
                <ChoiceChip key={v.key} label={v.label} selected={s.form.vehicle === v.key} onPress={() => dispatch(setRiderField({ field: 'vehicle', value: v.key }))} />
              ))}
            </View>
            {s.error.message ? <InlineNotice message={s.error.message} /> : null}
          </View>
        )}
      </Sheet>
    </ScreenShell>
  );
};

export default VendorRiders;
