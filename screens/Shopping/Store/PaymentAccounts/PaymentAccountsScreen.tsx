// ═══════════════════════════════════════════════════════
// MetroMatrix — Payment accounts (where customers or patients send transfers)
// ═══════════════════════════════════════════════════════
// Raast, JazzCash, Easypaisa or a bank account in the partner's own name.
// Customers (a doctor's patients) pay these directly; MetroMatrix never holds
// the money. One screen for stores and doctors: the business picks the words.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { PAYMENT_ACCOUNT_KINDS, accountKindLabel, validatePaymentAccount } from '../../../../models/shopping/storeModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, ChoiceChip, EmptyState, InlineNotice, ScreenShell, Sheet, SkeletonLines, StatusPill, TextAction, TextField } from '../../../../Custom-Components/index';
import type { PaymentAccount, StorePartnerStackParamList } from '../../../../types';
import { Alert } from '../../../../utils/alert';
import {
  changeAccountAsync,
  closeAccountSheet,
  loadAccountsAsync,
  markAccountSubmitted,
  openAccountSheet,
  selectPaymentAccounts,
  setAccountField,
} from './paymentAccountsSlice';

type Props = NativeStackScreenProps<StorePartnerStackParamList, 'PaymentAccounts'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    actions: { flexDirection: 'row', gap: space.s16 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

/** "PK36SCBL0000001123456702" → "PK36 •••• 6702" in lists. */
const masked = (n: string) => (n.length > 8 ? `${n.slice(0, 4)} •••• ${n.slice(-4)}` : n);

/** Each partner app's tabs (the screen is pushed over them from More). */
const TABS_OF = { shopping: 'StoreTabs', healthcare: 'DoctorTabs', food: 'VendorTabs' } as const;
const EMPTY_BODY = {
  shopping: 'Add one to take transfers. Without one, customers can only pay cash on delivery.',
  healthcare: 'Add one to take transfers before video consultations. Without one, patients pay at the visit.',
  food: 'Add one to take transfers. Without one, customers pay cash on delivery or when they collect.',
} as const;

const PaymentAccountsScreen: React.FC<Props> = props => {
  const service = useAppSelector(st => st.auth.business?.serviceType) ?? 'shopping';
  return (
    <ServiceScope service={service}>
      <PaymentAccountsContent {...props} />
    </ServiceScope>
  );
};

const PaymentAccountsContent: React.FC<Props> = () => {
  const service = useAppSelector(st => st.auth.business?.serviceType);
  const { back } = useBack({ name: TABS_OF[service ?? 'shopping'], params: { screen: 'MoreTab' } });
  const who = service === 'healthcare' ? 'Patients' : 'Customers';
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectPaymentAccounts);
  const f = s.form;
  const kind = PAYMENT_ACCOUNT_KINDS.find(k => k.key === f.kind) ?? PAYMENT_ACCOUNT_KINDS[0];
  const errors = s.submitted ? validatePaymentAccount(f) : {};

  useEffect(() => {
    void dispatch(loadAccountsAsync());
  }, [dispatch]);

  const save = () => {
    dispatch(markAccountSubmitted());
    if (Object.keys(validatePaymentAccount(f)).length) return;
    void dispatch(changeAccountAsync({ kind: 'save', id: s.editing ?? '', input: f }));
  };

  const remove = (a: PaymentAccount) =>
    Alert.alert(`Remove ${accountKindLabel(a.kind)} ${masked(a.number)}?`, `${who} will no longer see it.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void dispatch(changeAccountAsync({ kind: 'delete', id: a.id })) },
    ]);

  return (
    <ScreenShell
      title="Payment accounts"
      subtitle={`${who} who pay by transfer send money here, straight to you.`}
      onBack={back}
      footer={<Button label="Add an account" leftIcon="add" onPress={() => dispatch(openAccountSheet(null))} fullWidth />}>
      {s.error.message && s.editing === null ? <InlineNotice message={s.error.message} /> : null}
      {s.status === 'loading' && !s.accounts.length ? (
        <SkeletonLines lines={4} />
      ) : !s.accounts.length ? (
        <EmptyState icon="credit-card" title="No accounts yet" body={EMPTY_BODY[service ?? 'shopping']} />
      ) : (
        s.accounts.map(a => (
          <Card key={a.id}>
            <View style={styles.head}>
              <AppText variant="title">{accountKindLabel(a.kind)}</AppText>
              <StatusPill label={a.isActive ? `Shown to ${who.toLowerCase()}` : 'Off'} tone={a.isActive ? 'success' : 'neutral'} />
            </View>
            <AppText variant="bodyStrong">{a.title}</AppText>
            <AppText variant="body" tone="muted">
              {masked(a.number)}
              {a.bankName ? ` · ${a.bankName}` : ''}
            </AppText>
            <View style={styles.actions}>
              <TextAction label="Edit" onPress={() => dispatch(openAccountSheet(a))} />
              <TextAction label={a.isActive ? 'Turn off' : 'Turn on'} onPress={() => void dispatch(changeAccountAsync({ kind: 'toggle', account: a }))} disabled={!!s.busy} />
              <TextAction label="Remove" tone="danger" onPress={() => remove(a)} disabled={!!s.busy} />
            </View>
          </Card>
        ))
      )}

      <Sheet
        visible={s.editing !== null}
        onClose={() => dispatch(closeAccountSheet())}
        title={s.editing ? 'Edit account' : 'Add an account'}
        footer={<Button label="Save account" onPress={save} loading={s.busy === 'save'} fullWidth />}>
        <View style={styles.chips}>
          {PAYMENT_ACCOUNT_KINDS.map(k => (
            <ChoiceChip key={k.key} label={k.label} selected={f.kind === k.key} onPress={() => dispatch(setAccountField({ field: 'kind', value: k.key }))} />
          ))}
        </View>
        <TextField label="Account title" value={f.title} onChangeText={t => dispatch(setAccountField({ field: 'title', value: t }))} error={errors.title} helper="Exactly as your bank or wallet shows it." />
        <TextField
          label={kind.numberLabel}
          value={f.number}
          onChangeText={t => dispatch(setAccountField({ field: 'number', value: t }))}
          error={errors.number}
          placeholder={kind.placeholder}
          autoCapitalize="characters"
          keyboardType={f.kind === 'bank' ? 'default' : 'number-pad'}
        />
        {f.kind === 'bank' ? (
          <TextField label="Bank" value={f.bankName ?? ''} onChangeText={t => dispatch(setAccountField({ field: 'bankName', value: t }))} error={errors.bankName} placeholder="Meezan Bank" />
        ) : null}
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default PaymentAccountsScreen;
