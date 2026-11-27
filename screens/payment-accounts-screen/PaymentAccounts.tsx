// ═══════════════════════════════════════════════════════
// MetroMatrix — Payment accounts (where customers or patients send transfers)
// ═══════════════════════════════════════════════════════
// Raast, JazzCash, Easypaisa or a bank account in the partner's own name.
// Customers (a doctor's patients) pay these directly; MetroMatrix never holds
// the money. One screen for stores, doctors and kitchens: the business picks
// the words. A doctor's or kitchen's saved account keeps its type and number
// (their APIs change only the title, bank and on/off), so a new number is
// "remove and add a new one"; a store's account can change all of it.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { PAYMENT_ACCOUNT_KINDS, accountKindLabel, validatePaymentAccount } from '../../models/shopping/storeModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, ChoiceChip, EmptyState, InlineNotice, ListRow, RowCardsSkeleton, ScreenShell, SectionCard, Sheet, StatusPill, TextAction, TextField } from '../../Custom-Components/index';
import type { PaymentAccount, StorePartnerStackParamList } from '../../models';
import { Alert } from '../../utils/alert/alert';
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
    actions: { flexDirection: 'row', gap: space.s16 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    fixed: { gap: space.s4 },
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
/** Services whose saved accounts keep their type and number. */
const FIXED_NUMBER = new Set(['healthcare', 'food']);

const PaymentAccounts: React.FC<Props> = props => {
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
  const editingAccount = s.editing ? s.accounts.find(a => a.id === s.editing) ?? null : null;
  const numberFixed = !!editingAccount && FIXED_NUMBER.has(service ?? 'shopping');

  useEffect(() => {
    void dispatch(loadAccountsAsync());
  }, [dispatch]);

  const save = () => {
    dispatch(markAccountSubmitted());
    if (Object.keys(validatePaymentAccount(f)).length) return;
    void dispatch(changeAccountAsync({ kind: 'save', id: s.editing ?? '', input: f }));
  };

  /** A new number for a doctor's or kitchen's account: remove this one, then add the new one. */
  const replace = (a: PaymentAccount) =>
    Alert.alert(`Remove ${accountKindLabel(a.kind)} ${masked(a.number)}?`, `Then add the new number. ${who} stop seeing this one at once.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          void dispatch(changeAccountAsync({ kind: 'delete', id: a.id })).then(r => {
            if (!changeAccountAsync.fulfilled.match(r)) return;
            dispatch(openAccountSheet(null));
            dispatch(setAccountField({ field: 'kind', value: a.kind }));
          }),
      },
    ]);

  const remove = (a: PaymentAccount) =>
    Alert.alert(`Remove ${accountKindLabel(a.kind)} ${masked(a.number)}?`, `${who} will no longer see it.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void dispatch(changeAccountAsync({ kind: 'delete', id: a.id })) },
    ]);

  return (
    <ScreenShell
      title="Payment accounts"
      subtitle="Transfers come straight to you"
      onBack={back}
      footer={<Button label="Add an account" leftIcon="add" onPress={() => dispatch(openAccountSheet(null))} fullWidth />}>
      {s.error.message && s.editing === null ? (
        <InlineNotice
          message={s.error.message}
          action={s.status === 'failed' ? { label: 'Try again', onPress: () => void dispatch(loadAccountsAsync()) } : undefined}
        />
      ) : null}
      {s.status === 'loading' && !s.accounts.length ? (
        <RowCardsSkeleton count={2} />
      ) : s.status === 'failed' && !s.accounts.length ? null : !s.accounts.length ? (
        <EmptyState icon="card-outline" title="No accounts yet" body={EMPTY_BODY[service ?? 'shopping']} />
      ) : (
        s.accounts.map(a => (
          <SectionCard
            key={a.id}
            title={accountKindLabel(a.kind)}
            icon="card-outline"
            action={<StatusPill label={a.isActive ? `Shown to ${who.toLowerCase()}` : 'Off'} tone={a.isActive ? 'success' : 'neutral'} />}>
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
          </SectionCard>
        ))
      )}

      <Sheet
        visible={s.editing !== null}
        onClose={() => dispatch(closeAccountSheet())}
        title={s.editing ? 'Edit account' : 'Add an account'}
        footer={<Button label="Save account" onPress={save} loading={s.busy === 'save'} fullWidth />}>
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
        {numberFixed && editingAccount ? (
          <View style={styles.fixed}>
            <ListRow title={accountKindLabel(editingAccount.kind)} subtitle={editingAccount.number} leftIcon="lock-closed-outline" />
            <AppText variant="small" tone="muted">
              The type and number stay as saved. For a new number, remove this account and add the new one.
            </AppText>
            <TextAction label="Remove and add a new one" tone="danger" onPress={() => replace(editingAccount)} disabled={!!s.busy} />
          </View>
        ) : (
          <View style={styles.chips}>
            {PAYMENT_ACCOUNT_KINDS.map(k => (
              <ChoiceChip key={k.key} label={k.label} selected={f.kind === k.key} onPress={() => dispatch(setAccountField({ field: 'kind', value: k.key }))} />
            ))}
          </View>
        )}
        <TextField
          label="Account title"
          value={f.title}
          onChangeText={t => dispatch(setAccountField({ field: 'title', value: t }))}
          error={errors.title}
          helper="Exactly as your bank or wallet shows it."
          maxLength={80}
        />
        {numberFixed ? null : (
          <TextField
            label={kind.numberLabel}
            value={f.number}
            onChangeText={t => dispatch(setAccountField({ field: 'number', value: t }))}
            error={errors.number}
            placeholder={kind.placeholder}
            autoCapitalize="characters"
            keyboardType={f.kind === 'bank' ? 'default' : 'number-pad'}
          />
        )}
        {f.kind === 'bank' ? (
          <TextField
            label="Bank"
            value={f.bankName ?? ''}
            onChangeText={t => dispatch(setAccountField({ field: 'bankName', value: t }))}
            error={errors.bankName}
            placeholder="Meezan Bank"
            maxLength={80}
          />
        ) : null}
      </Sheet>
    </ScreenShell>
  );
};

export default PaymentAccounts;
