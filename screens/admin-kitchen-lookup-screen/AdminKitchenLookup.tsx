// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: find a tiffin, a dawat or an order
// ═══════════════════════════════════════════════════════
// For a dispute: type the code a customer or kitchen gives (CT-… for a
// dawat, FC-… for an order, or a tiffin's id) and see who, what, when, its
// state and where its payment stands. Read only; customers pay kitchens
// directly.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { validateLookupCode } from '../../models/kitchen/adminKitchenModel';
import { useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, Divider, InlineNotice, ScreenShell, StatusPill, TextField } from '../../Custom-Components/index';
import type { AdminFoodStackParamList, GrowthLookup } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { lookupCodeAsync, markLookupSubmitted, selectAdminKitchenLookup, setLookupCode } from './adminKitchenLookupSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminKitchenLookup'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    line: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12, paddingVertical: space.s4 },
  });

const KIND_LABEL: Record<GrowthLookup['kind'], string> = { tiffin: 'Tiffin', catering: 'Dawat', order: 'Order' };

const Line: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => {
  const styles = useStyles(makeStyles);
  return value ? (
    <View style={styles.line}>
      <AppText variant="small" tone="muted">
        {label}
      </AppText>
      <AppText variant="small" align="right" style={styles.grow}>
        {value}
      </AppText>
    </View>
  ) : null;
};

const ResultCard: React.FC<{ r: GrowthLookup }> = ({ r }) => {
  const styles = useStyles(makeStyles);
  return (
    <Card>
      <View style={styles.gap}>
        <View style={styles.head}>
          <View style={styles.grow}>
            <AppText variant="overline" tone="muted">
              {`${KIND_LABEL[r.kind]} · ${r.code}`}
            </AppText>
            <AppText variant="title">{r.vendor}</AppText>
          </View>
          <StatusPill label={r.status.replace(/_/g, ' ')} />
        </View>
        <Divider />
        <Line label="Customer" value={r.customer} />
        {r.lines.map(l => (
          <Line key={l.label} label={l.label} value={l.value} />
        ))}
      </View>
    </Card>
  );
};

const AdminKitchenLookup: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const s = useAppSelector(selectAdminKitchenLookup);
  const errors = s.submitted ? validateLookupCode(s.code) : {};

  // A link with a code looks it up at once.
  const linked = route.params?.code;
  useEffect(() => {
    if (!linked) return;
    dispatch(setLookupCode(linked));
    void dispatch(lookupCodeAsync(linked));
  }, [dispatch, linked]);

  const find = () => {
    dispatch(markLookupSubmitted());
    if (Object.keys(validateLookupCode(s.code)).length) return haptics.warning();
    void dispatch(lookupCodeAsync(s.code));
  };

  return (
    <ScreenShell title="Find a tiffin, dawat or order" subtitle="By the code the customer or kitchen gives you" onBack={back}>
      <TextField
        label="Code"
        value={s.code}
        onChangeText={t => dispatch(setLookupCode(t))}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="CT-MHD7Q4 or FC-7KQ2PX"
        returnKeyType="search"
        onSubmitEditing={find}
        error={errors.code}
      />
      <Button label="Find it" leftIcon="search-outline" loading={s.status === 'loading'} onPress={find} fullWidth />
      {s.status === 'failed' ? <InlineNotice tone={s.error.code === 'NOT_FOUND' ? 'info' : 'error'} message={s.error.message} /> : null}
      {s.result ? <ResultCard r={s.result} /> : null}
      <AppText variant="caption" tone="muted">
        MetroMatrix takes no commission: customers pay the kitchen directly, so payments here are what the kitchen recorded.
      </AppText>
    </ScreenShell>
  );
};

export default AdminKitchenLookup;
