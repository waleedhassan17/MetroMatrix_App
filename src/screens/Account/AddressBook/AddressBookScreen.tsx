// ═══════════════════════════════════════════════════════
// MetroMatrix — Delivery addresses (Profile → Addresses)
// ═══════════════════════════════════════════════════════
// The default first. Edit, make default or delete each; add a new one.

import React, { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { ADDRESS_LABELS, formatAddress } from '@models/addressModel';
import { useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, Card, EmptyState, InlineNotice, IonIcon, ScreenShell, SkeletonLines, StatusPill, TextAction } from '@custom/index';
import type { AccountStackParamList, Address } from '@/types';
import { Alert } from '@utils/alert';
import { formatPkPhoneForDisplay } from '@utils/phone';
import { deleteAddressAsync, loadAddressesAsync, selectAddressBook, setDefaultAddressAsync } from './addressBookSlice';

type Props = NativeStackScreenProps<AccountStackParamList, 'AddressBook'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s12 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    grow: { flex: 1 },
    actions: { flexDirection: 'row', gap: space.s16, flexWrap: 'wrap' },
  });

const AddressCard: React.FC<{ address: Address; busy: boolean; onEdit: () => void; onDefault: () => void; onDelete: () => void }> = ({
  address,
  busy,
  onEdit,
  onDefault,
  onDelete,
}) => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const label = ADDRESS_LABELS.find(l => l.key === address.label) ?? ADDRESS_LABELS[0];
  return (
    <Card selected={address.isDefault}>
      <View style={styles.head}>
        <IonIcon name={label.icon} size="md" color={service.accentDeep} />
        <AppText variant="title" style={styles.grow}>
          {label.label}
        </AppText>
        {address.isDefault ? <StatusPill label="Default" tone="accent" /> : null}
      </View>
      <View>
        <AppText variant="bodyStrong">{address.fullName}</AppText>
        <AppText variant="body" tone="muted">
          {formatAddress(address)}
        </AppText>
        {address.landmark ? (
          <AppText variant="small" tone="muted">
            {address.landmark}
          </AppText>
        ) : null}
        <AppText variant="small" tone="muted">
          {formatPkPhoneForDisplay(address.phone)}
        </AppText>
      </View>
      <View style={styles.actions}>
        <TextAction label="Edit" onPress={onEdit} disabled={busy} />
        {!address.isDefault ? <TextAction label="Make default" onPress={onDefault} disabled={busy} /> : null}
        <TextAction label="Delete" onPress={onDelete} disabled={busy} tone="danger" />
      </View>
    </Card>
  );
};

const AddressBookScreen: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'Profile' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAddressBook);

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadAddressesAsync());
    }, [dispatch]),
  );

  const confirmDelete = (a: Address) =>
    Alert.alert('Delete this address?', formatAddress(a), [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void dispatch(deleteAddressAsync(a.id)) },
    ]);

  return (
    <ScreenShell
      title="Addresses"
      onBack={back}
      scroll={false}
      footer={<Button label="Add an address" leftIcon="add" onPress={() => navigation.navigate('AddressForm')} fullWidth />}>
      {s.actionError.message ? <InlineNotice message={s.actionError.message} /> : null}
      <FlatList
        data={s.addresses}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <AddressCard
            address={item}
            busy={s.busyId === item.id}
            onEdit={() => navigation.navigate('AddressForm', { id: item.id })}
            onDefault={() => void dispatch(setDefaultAddressAsync(item.id))}
            onDelete={() => confirmDelete(item)}
          />
        )}
        ListEmptyComponent={
          s.status === 'loading' ? (
            <SkeletonLines lines={5} />
          ) : s.status === 'failed' ? (
            <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadAddressesAsync()) }} />
          ) : (
            <EmptyState icon="map-pin" title="No addresses yet" body="Add where you'd like things delivered. You can keep home, work and more." />
          )
        }
      />
    </ScreenShell>
  );
};

export default AddressBookScreen;
