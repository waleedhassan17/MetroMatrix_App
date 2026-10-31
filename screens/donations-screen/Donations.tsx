// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: donations
// ═══════════════════════════════════════════════════════
// Food given away instead of thrown away: how many meals and to whom. It
// counts, with Bachat Box pickups, as meals rescued — shared as one line.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { rescuedShareText, validateDonation } from '../../models/kitchen/wasteModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { Button, Card, EmptyState, InlineNotice, ScreenShell, SkeletonLines, TextField, AppText } from '../../Custom-Components/index';
import { RowCard, StatGrid } from '../../Components/admin/AdminParts';
import type { FoodVendorStackParamList } from '../../models';
import { formatWhen } from '../../utils/health-time/healthTime';
import { haptics } from '../../utils/haptics/haptics';
import { shareText } from '../../utils/share-text/shareText';
import { selectBusiness } from '../../store/authSlice';
import { editDonation, loadDonationsAsync, logDonationAsync, selectDonations, setDonationErrors } from './donationsSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenDonations'>;

const TZ = 'Asia/Karachi';

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
  });

const Donations: React.FC<Props> = props => (
  <ServiceScope service="food">
    <DonationsContent {...props} />
  </ServiceScope>
);

const DonationsContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'KitchenWaste' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectDonations);
  const kitchen = useAppSelector(selectBusiness)?.name ?? 'Our kitchen';
  const load = useCallback(() => void dispatch(loadDonationsAsync()), [dispatch]);
  useFocusEffect(load);

  const save = async () => {
    const errors = validateDonation(s.form);
    if (Object.keys(errors).length) {
      dispatch(setDonationErrors(errors));
      haptics.warning();
      return;
    }
    const r = await dispatch(logDonationAsync({ meals: Number(s.form.meals), to: s.form.to.trim(), note: s.form.note.trim() || undefined }));
    if (logDonationAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Donation recorded', text2: 'Thank you for keeping good food in use.' });
    } else haptics.warning();
  };

  const total = s.data?.mealsRescued.total ?? 0;

  return (
    <ScreenShell title="Donations" subtitle="Meals given away instead of thrown away" onBack={back} refreshing={s.status === 'loading' && !!s.data} onRefresh={load}>
      {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      <StatGrid
        stats={[
          { key: 'total', icon: 'heart-outline', tint: 'rose', value: s.data ? total : null, label: 'Meals rescued', hint: 'Bachat Box pickups and donations' },
          { key: 'week', icon: 'calendar-outline', tint: 'blue', value: s.data ? s.data.mealsRescued.week : null, label: 'This week' },
        ]}
      />
      {total > 0 ? (
        <Button
          label="Share what you rescued"
          variant="secondary"
          leftIcon="share-outline"
          onPress={() =>
            void shareText(rescuedShareText(kitchen, total), 'Meals rescued').then(o => {
              if (o === 'copied') Toast.show({ type: 'success', text1: 'Copied', text2: 'Paste it into your status or a message.' });
            })
          }
          fullWidth
        />
      ) : null}

      <Card>
        <View style={styles.gap}>
          <AppText variant="title">Record a donation</AppText>
          {s.saveError.message ? <InlineNotice message={s.saveError.message} /> : null}
          <TextField label="Meals" value={s.form.meals} onChangeText={meals => dispatch(editDonation({ meals }))} keyboardType="number-pad" placeholder="12" error={s.errors.meals} />
          <TextField label="Given to" value={s.form.to} onChangeText={to => dispatch(editDonation({ to }))} placeholder="Edhi centre, Gulberg" maxLength={80} error={s.errors.to} />
          <TextField label="Note (optional)" value={s.form.note} onChangeText={note => dispatch(editDonation({ note }))} maxLength={200} />
          <Button label="Save" onPress={() => void save()} loading={s.saving} fullWidth />
        </View>
      </Card>

      <AppText variant="sectionTitle">Given</AppText>
      {!s.data ? (
        s.status === 'failed' ? null : <SkeletonLines lines={4} />
      ) : !s.data.items.length ? (
        <EmptyState icon="heart" title="No donations yet" body="Food you give away to a shelter, a mosque or a langar counts here." />
      ) : (
        s.data.items.map(d => <RowCard key={d.id} title={d.to} mark={{ icon: 'heart-outline', tint: 'rose' }} lines={[formatWhen(d.at, TZ), d.note]} amount={`${d.meals} ${d.meals === 1 ? 'meal' : 'meals'}`} />)
      )}
    </ScreenShell>
  );
};

export default Donations;
