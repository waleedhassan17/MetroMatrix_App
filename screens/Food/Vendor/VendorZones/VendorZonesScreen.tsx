// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor delivery zones
// ═══════════════════════════════════════════════════════
// What delivery costs, by distance from the kitchen: up to six bands, each
// with its fee and its minimum order. Distance is a straight line from the
// pin; customers past the last band see "Pick-up only" (or nothing).

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { MAX_FEE_BANDS, bandsFromForm, validateFeeBands } from '../../../../models/food/vendorModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, IconButton, InlineNotice, ScreenShell, SkeletonLines, TextAction, TextField } from '../../../../Custom-Components/index';
import { FoodMap } from '../../../../Custom-Components/food/map/FoodMap';
import type { FoodVendorStackParamList } from '../../../../types';
import { formatPKR } from '../../../../utils/money';
import { haptics } from '../../../../utils/haptics';
import { addBand, loadZonesAsync, markZonesSubmitted, removeBand, saveZonesAsync, selectVendorZones, setBandField } from './vendorZonesSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorZones'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    band: { gap: space.s8 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    fields: { flexDirection: 'row', gap: space.s8 },
    field: { flex: 1 },
  });

const VendorZonesScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <VendorZonesContent {...props} />
  </ServiceScope>
);

const VendorZonesContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorZones);

  useEffect(() => {
    void dispatch(loadZonesAsync());
  }, [dispatch]);

  const errors = s.submitted ? validateFeeBands(s.rows, s.maxRadiusKm) : {};
  const bands = bandsFromForm(s.rows);

  const save = async () => {
    dispatch(markZonesSubmitted());
    if (Object.keys(validateFeeBands(s.rows, s.maxRadiusKm)).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(saveZonesAsync(s.rows));
    if (saveZonesAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Delivery zones saved' });
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title="Delivery zones"
      subtitle={`Fees by distance, up to ${s.maxRadiusKm} km`}
      onBack={back}
      footer={<Button label="Save zones" onPress={() => void save()} loading={s.saving} disabled={!s.dirty} fullWidth />}
    >
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      {errors.bands ? <InlineNotice message={errors.bands} /> : null}
      {s.status === 'loading' && !s.rows.length ? (
        <SkeletonLines lines={6} />
      ) : (
        <>
          {s.kitchen ? (
            <FoodMap pins={[{ id: 'kitchen', kind: 'vendor', at: s.kitchen, label: 'Your kitchen' }]} height={160} interactive={false} accessibilityLabel="Map of your kitchen" />
          ) : null}
          {s.rows.map((row, i) => (
            <Card key={i} style={styles.band}>
              <View style={styles.head}>
                <AppText variant="title">{`${bands[i].fromKm} – ${Number.isFinite(bands[i].toKm) ? bands[i].toKm : '…'} km`}</AppText>
                <IconButton icon="trash-outline" accessibilityLabel={`Remove the band from ${bands[i].fromKm} km`} onPress={() => dispatch(removeBand(i))} />
              </View>
              <View style={styles.fields}>
                <View style={styles.field}>
                  <TextField
                    label="Up to (km)"
                    value={row.toKm}
                    onChangeText={v => dispatch(setBandField({ index: i, field: 'toKm', value: v.replace(/[^\d.]/g, '') }))}
                    keyboardType="decimal-pad"
                    error={errors[`${i}.toKm`]}
                  />
                </View>
                <View style={styles.field}>
                  <TextField
                    label="Fee (Rs)"
                    value={row.fee}
                    onChangeText={v => dispatch(setBandField({ index: i, field: 'fee', value: v.replace(/[^\d]/g, '') }))}
                    keyboardType="number-pad"
                    error={errors[`${i}.fee`]}
                  />
                </View>
                <View style={styles.field}>
                  <TextField
                    label="Min order (Rs)"
                    value={row.minOrder}
                    onChangeText={v => dispatch(setBandField({ index: i, field: 'minOrder', value: v.replace(/[^\d]/g, '') }))}
                    keyboardType="number-pad"
                    error={errors[`${i}.minOrder`]}
                  />
                </View>
              </View>
              <AppText variant="small" tone="muted">
                {Number.isFinite(bands[i].fee) ? (bands[i].fee === 0 ? 'Free delivery' : `${formatPKR(bands[i].fee)} delivery`) : ''}
                {Number.isFinite(bands[i].minOrder) && bands[i].minOrder > 0 ? ` · Min ${formatPKR(bands[i].minOrder)}` : ''}
              </AppText>
            </Card>
          ))}
          {s.rows.length < MAX_FEE_BANDS ? <TextAction label={s.rows.length ? 'Add a farther band' : 'Add your first band'} icon="add" onPress={() => dispatch(addBand())} /> : null}
          <AppText variant="small" tone="muted">
            Distances are straight lines from your pin. To deliver farther, raise your delivery radius in Kitchen settings.
          </AppText>
          <TextAction label="Kitchen settings" icon="settings-outline" onPress={() => navigation.navigate('VendorSettings')} />
        </>
      )}
    </ScreenShell>
  );
};

export default VendorZonesScreen;
