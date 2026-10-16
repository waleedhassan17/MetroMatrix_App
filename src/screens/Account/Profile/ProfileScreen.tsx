// ═══════════════════════════════════════════════════════
// MetroMatrix — Profile (every role's Profile tab)
// ═══════════════════════════════════════════════════════
// The FYP's account screen. A gradient hero in the scope's colour (photo with
// a camera button, name, email, phone, who they are here), then three tabs:
//   Overview   counts (customers), then the menu in groups: Account, Shopping,
//              Health, each row with its own icon colour; Sign out, Delete
//              account, the app version.
//   Addresses  customers only: the saved addresses, with Add and Manage.
//   Settings   name and mobile (email is fixed), password, notifications.
// Partners and staff see Overview and Settings.

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import dayjs from 'dayjs';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useSignOut } from '@hooks/useSignOut';
import { useBack } from '@hooks/useBack';
import { useIsTabRoot, useServiceNav } from '@hooks/useServiceNav';
import { hasErrors, nationalFromPkPhone, validateProfile } from '@models/authModel';
import { ADDRESS_LABELS, formatAddress } from '@models/addressModel';
import { visibleErrors } from '@utils/formErrors';
import { haptics } from '@utils/haptics';
import { formatPkPhoneForDisplay } from '@utils/phone';
import { pickImageFromLibrary } from '@utils/pickers';
import { APP_VERSION } from '@/services/appInfo';
import { PageHeaderScope, useStyles, useTheme, type RowTint, type Theme } from '@theme/index';
import {
  AppText,
  Avatar,
  Button,
  Card,
  Divider,
  EmptyState,
  IconButton,
  InlineNotice,
  IonIcon,
  ListRow,
  ProgressBar,
  ScreenShell,
  SegmentTabs,
  Sheet,
  SkeletonLines,
  StatusPill,
  TextField,
  type IonName,
} from '@custom/index';
import type { AccountStackParamList } from '@/types';
import { selectBusiness, selectUser } from '../../Auth/authSlice';
import { loadAddressesAsync, selectAddressBook } from '../AddressBook/addressBookSlice';
import { loadFamilyAsync, selectFamily } from '../../Health/Patient/FamilyMembers/familySlice';
import { loadSavedIdsAsync, selectSavedIds, selectSavedStatus } from '../../Shopping/Customer/Saved/savedSlice';
import {
  closeDelete,
  deleteAccountAsync,
  loadFromUser,
  openDelete,
  saveProfileAsync,
  selectProfile,
  setDeleteConfirmation,
  setName,
  setPhone,
  setProfileTab,
  touch,
  uploadAvatarAsync,
  type ProfileTab,
} from './profileSlice';

type Props = NativeStackScreenProps<AccountStackParamList, 'Profile'>;

const ROLE_LABEL: Record<string, string> = {
  customer: 'Customer',
  partner: 'Partner',
  admin: 'Admin',
  super_admin: 'Super admin',
};

interface MenuItem {
  key: string;
  title: string;
  subtitle?: string;
  icon: IonName;
  /** A categorical colour; omitted rows take the service accent (the FYP's module rows). */
  tint?: RowTint;
  onPress: () => void;
}

const makeStyles = ({ colors, space, radius, size, rowTint }: Theme) =>
  StyleSheet.create({
    hero: { alignItems: 'center', gap: space.s4, paddingBottom: space.s4 },
    avatar: { paddingBottom: space.s8 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      marginTop: space.s8,
      paddingHorizontal: space.s12,
      paddingVertical: space.s4,
      borderRadius: radius.pill,
      backgroundColor: colors.onScrimTint,
      borderWidth: size.hairline,
      borderColor: colors.onScrimLine,
    },
    progress: { alignSelf: 'stretch', paddingTop: space.s8 },
    stats: { flexDirection: 'row', gap: space.s12 },
    stat: {
      flex: 1,
      alignItems: 'center',
      gap: space.s4,
      paddingVertical: space.s16,
      paddingHorizontal: space.s8,
      borderRadius: radius.lg,
      borderWidth: size.hairline,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    statIcon: { width: size.subTypeTile, height: size.subTypeTile, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    section: { gap: space.s8 },
    signOut: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s12,
      minHeight: size.control.lg,
      paddingHorizontal: space.s16,
      borderRadius: radius.lg,
      borderWidth: size.hairline,
      borderColor: colors.line,
    },
    signOutIcon: {
      width: size.subTypeTile,
      height: size.subTypeTile,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: rowTint.red.bg,
    },
    deleteLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s4, minHeight: size.touch },
    addressHead: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    grow: { flex: 1 },
  });

/** One count in the stat row: an icon chip, the number, what it counts. */
const StatTile: React.FC<{ icon: IonName; tint: RowTint | 'accent'; value: number | null; label: string; onPress: () => void }> = ({
  icon,
  tint,
  value,
  label,
  onPress,
}) => {
  const styles = useStyles(makeStyles);
  const { rowTint, service, opacity } = useTheme();
  const t = tint === 'accent' ? { bg: service.accentSoft, fg: service.accentDeep } : rowTint[tint];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? 'loading'}`}
      style={({ pressed }) => [styles.stat, pressed && { opacity: opacity.pressed }]}>
      <View style={[styles.statIcon, { backgroundColor: t.bg }]}>
        <IonIcon name={icon} size="md" color={t.fg} />
      </View>
      <AppText variant="h2">{value ?? '–'}</AppText>
      <AppText variant="caption" tone="muted" align="center" numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
};

const MenuSection: React.FC<{ title: string; items: MenuItem[] }> = ({ title, items }) => {
  const styles = useStyles(makeStyles);
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <AppText variant="overline" tone="muted" accessibilityRole="header">
        {title}
      </AppText>
      <Card padded="horizontal">
        {items.map((item, i) => (
          <React.Fragment key={item.key}>
            {i > 0 ? <Divider /> : null}
            <ListRow title={item.title} subtitle={item.subtitle} leftIcon={item.icon} tint={item.tint} onPress={item.onPress} />
          </React.Fragment>
        ))}
      </Card>
    </View>
  );
};

const ProfileScreen: React.FC<Props> = props => (
  <PageHeaderScope>
    <ProfileContent {...props} />
  </PageHeaderScope>
);

const ProfileContent: React.FC<Props> = ({ navigation }) => {
  // A tab's first screen in the customer app; pushed from More in the partner apps.
  const { back, canGoBack } = useBack();
  const asTab = useIsTabRoot();
  // Rows that belong to a service open in that service's app (over its tabs).
  const svc = useServiceNav();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, opacity, service } = useTheme();
  const user = useAppSelector(selectUser);
  const business = useAppSelector(selectBusiness);
  const p = useAppSelector(selectProfile);
  const addressBook = useAppSelector(selectAddressBook);
  const family = useAppSelector(selectFamily);
  const savedIds = useAppSelector(selectSavedIds);
  const savedStatus = useAppSelector(selectSavedStatus);
  const { confirmSignOut } = useSignOut();
  const isCustomer = user?.role === 'customer';

  useEffect(() => {
    if (user && p.loadedFor !== user.id) dispatch(loadFromUser(user));
  }, [user, p.loadedFor, dispatch]);

  // The counts and the Addresses tab read the same slices their own screens own.
  useEffect(() => {
    if (!isCustomer) return;
    if (addressBook.status === 'idle') void dispatch(loadAddressesAsync());
    if (family.status === 'idle') void dispatch(loadFamilyAsync());
    if (savedStatus === 'idle') void dispatch(loadSavedIdsAsync());
  }, [isCustomer, addressBook.status, family.status, savedStatus, dispatch]);

  if (!user) return null;

  const tabs: { key: ProfileTab; label: string }[] = isCustomer
    ? [
        { key: 'overview', label: 'Overview' },
        { key: 'addresses', label: 'Addresses' },
        { key: 'settings', label: 'Settings' },
      ]
    : [
        { key: 'overview', label: 'Overview' },
        { key: 'settings', label: 'Settings' },
      ];
  const tab = tabs.some(t => t.key === p.tab) ? p.tab : 'overview';

  const errors = validateProfile({ name: p.name, phone: p.phone });
  const shown = visibleErrors(errors, p.touched);
  const dirty = p.name.trim() !== user.name || p.phone !== nationalFromPkPhone(user.phone);
  const googleOnly = !user.hasPassword;
  const deleteReady = googleOnly ? p.deleteConfirmation.trim() === 'DELETE' : p.deleteConfirmation.length > 0;

  // Jumps into another tab keep that tab's first screen underneath.

  const save = async () => {
    if (hasErrors(errors)) return;
    const r = await dispatch(saveProfileAsync({ name: p.name, phone: p.phone }));
    if (saveProfileAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Profile saved' });
    } else haptics.warning();
  };

  const changePhoto = async () => {
    const file = await pickImageFromLibrary({ square: true });
    if (!file) return;
    const r = await dispatch(uploadAvatarAsync(file));
    if (uploadAvatarAsync.fulfilled.match(r)) haptics.success();
    else haptics.warning();
  };

  const confirmDelete = async () => {
    if (!deleteReady) return;
    const r = await dispatch(deleteAccountAsync(googleOnly ? { confirm: 'DELETE' } : { password: p.deleteConfirmation }));
    if (deleteAccountAsync.fulfilled.match(r)) {
      Toast.show({ type: 'success', text1: 'Account deleted', text2: 'Your data has been removed.' });
    } else haptics.warning();
  };

  const who = [ROLE_LABEL[user.role], business?.name ?? `since ${dayjs(user.createdAt).format('MMM YYYY')}`].filter(Boolean).join(' · ');

  const account: MenuItem[] = [
    { key: 'edit', title: 'Edit profile', subtitle: 'Your name, mobile and photo', icon: 'create-outline', tint: 'violet', onPress: () => dispatch(setProfileTab('settings')) },
    ...(isCustomer
      ? [
          {
            key: 'addresses',
            title: 'My addresses',
            subtitle: addressBook.status === 'succeeded' ? `${addressBook.addresses.length} saved` : 'Where your orders are delivered',
            icon: 'location-outline' as IonName,
            tint: 'red' as RowTint,
            onPress: () => dispatch(setProfileTab('addresses')),
          },
        ]
      : []),
    { key: 'notifications', title: 'Notifications', subtitle: 'Orders, visits and offers', icon: 'notifications-outline', tint: 'amber', onPress: () => navigation.navigate('Notifications') },
    {
      key: 'password',
      title: googleOnly ? 'Set a password' : 'Change password',
      subtitle: googleOnly ? 'Sign in with email as well as Google' : 'Keep your account secure',
      icon: 'lock-closed-outline',
      tint: 'blue',
      onPress: () => navigation.navigate('ChangePassword'),
    },
  ];

  const shopping: MenuItem[] = isCustomer
    ? [
        { key: 'orders', title: 'My orders', subtitle: 'Track and review every order', icon: 'receipt-outline', onPress: () => svc.openShopTab('ShopOrdersTab') },
        { key: 'saved', title: 'Saved', subtitle: 'Products you hearted', icon: 'heart-outline', tint: 'rose', onPress: () => svc.openShopTab('SavedTab') },
      ]
    : [];

  const health: MenuItem[] = isCustomer
    ? [
        { key: 'visits', title: 'My appointments', subtitle: 'Upcoming and past visits', icon: 'calendar-outline', onPress: () => svc.openHealthTab('AppointmentsTab') },
        { key: 'records', title: 'Health records', subtitle: 'Reports, scans and results', icon: 'folder-open-outline', tint: 'blue', onPress: () => svc.openHealthTab('RecordsTab') },
        { key: 'rx', title: 'Prescriptions', subtitle: 'From your visits', icon: 'document-text-outline', tint: 'violet', onPress: () => svc.openHealth('PrescriptionList') },
        { key: 'family', title: 'Family members', subtitle: 'Book and keep records for them', icon: 'people-outline', tint: 'amber', onPress: () => svc.openHealth('FamilyMembers') },
      ]
    : [];

  const hero = (
    <View style={styles.hero}>
      <View style={styles.avatar}>
        <Avatar name={user.name || user.email} uri={user.avatarUrl} size="xl" editable uploading={p.avatarStatus === 'loading'} onPress={changePhoto} />
      </View>
      <AppText variant="h2" tone="onScrim" align="center" accessibilityRole="header">
        {user.name || 'Your profile'}
      </AppText>
      <AppText variant="small" align="center" style={{ color: colors.onScrimSoft }}>
        {user.email}
      </AppText>
      {user.phone ? (
        <AppText variant="caption" align="center" style={{ color: colors.onScrimSoft }}>
          {formatPkPhoneForDisplay(user.phone)}
        </AppText>
      ) : null}
      <View style={styles.pill}>
        <IonIcon name={isCustomer ? 'person-outline' : 'briefcase-outline'} size="sm" color={colors.onScrim} />
        <AppText variant="chip" tone="onScrim">
          {who}
        </AppText>
      </View>
      {p.avatarStatus === 'loading' ? (
        <View style={styles.progress}>
          <ProgressBar progress={p.avatarProgress} accessibilityLabel="Uploading photo" />
        </View>
      ) : null}
    </View>
  );

  const overview = (
    <>
      {isCustomer ? (
        <View style={styles.stats}>
          <StatTile
            icon="location-outline"
            tint="red"
            value={addressBook.status === 'succeeded' ? addressBook.addresses.length : null}
            label="Addresses"
            onPress={() => dispatch(setProfileTab('addresses'))}
          />
          <StatTile
            icon="people-outline"
            tint="violet"
            value={family.status === 'succeeded' ? family.members.length : null}
            label="Family"
            onPress={() => svc.openHealth('FamilyMembers')}
          />
          <StatTile icon="heart-outline" tint="accent" value={savedStatus === 'succeeded' ? savedIds.length : null} label="Saved" onPress={() => svc.openShopTab('SavedTab')} />
        </View>
      ) : null}
      <MenuSection title="Account" items={account} />
      <MenuSection title="Shopping" items={shopping} />
      <MenuSection title="Health" items={health} />
      <Pressable
        onPress={confirmSignOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={({ pressed }) => [styles.signOut, pressed && { opacity: opacity.pressed }]}>
        <View style={styles.signOutIcon}>
          <IonIcon name="log-out-outline" size="md" color={colors.danger} />
        </View>
        <AppText variant="title" tone="danger">
          Sign out
        </AppText>
      </Pressable>
      <Pressable onPress={() => dispatch(openDelete())} accessibilityRole="button" accessibilityLabel="Delete account" style={styles.deleteLink}>
        <IonIcon name="trash-outline" size="sm" color={colors.danger} />
        <AppText variant="small" tone="danger">
          Delete account
        </AppText>
      </Pressable>
      <AppText variant="caption" tone="faint" align="center">
        MetroMatrix v{APP_VERSION}
      </AppText>
    </>
  );

  const addresses = (
    <>
      {addressBook.status === 'loading' && !addressBook.addresses.length ? <SkeletonLines lines={4} /> : null}
      {addressBook.status === 'failed' ? (
        <InlineNotice message={addressBook.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadAddressesAsync()) }} />
      ) : null}
      {addressBook.status === 'succeeded' && !addressBook.addresses.length ? (
        <EmptyState icon="map-pin" title="No addresses yet" body="Add where your orders should go. You can pick it at checkout." />
      ) : null}
      {addressBook.addresses.map(a => {
        const label = ADDRESS_LABELS.find(l => l.key === a.label) ?? ADDRESS_LABELS[0];
        return (
          <Card key={a.id} selected={a.isDefault}>
            <View style={styles.addressHead}>
              <IonIcon name={label.icon} size="md" color={service.accentDeep} />
              <AppText variant="title" style={styles.grow}>
                {label.label}
              </AppText>
              {a.isDefault ? <StatusPill label="Default" tone="accent" /> : null}
            </View>
            <AppText variant="bodyStrong">{a.fullName}</AppText>
            <AppText variant="body" tone="muted">
              {formatAddress(a)}
            </AppText>
            <AppText variant="small" tone="muted">
              {formatPkPhoneForDisplay(a.phone)}
            </AppText>
          </Card>
        );
      })}
      <Button label="Add an address" leftIcon="add" onPress={() => navigation.navigate('AddressForm', undefined)} fullWidth />
      {addressBook.addresses.length ? <Button label="Manage addresses" variant="secondary" onPress={() => navigation.navigate('AddressBook')} fullWidth /> : null}
    </>
  );

  const settings = (
    <>
      <View style={styles.section}>
        <AppText variant="overline" tone="muted" accessibilityRole="header">
          Personal details
        </AppText>
        <Card>
          <TextField
            label="Full name"
            value={p.name}
            onChangeText={v => dispatch(setName(v))}
            onBlur={() => dispatch(touch('name'))}
            error={shown.name}
            autoCapitalize="words"
            autoComplete="name"
          />
          <TextField
            label="Mobile number"
            mode="phone"
            value={p.phone}
            onChangeText={v => dispatch(setPhone(v))}
            onBlur={() => dispatch(touch('phone'))}
            error={shown.phone}
            placeholder="312 3456789"
          />
          <TextField label="Email" mode="email" value={user.email} onChangeText={() => undefined} editable={false} helper="Your sign-in email can't be changed here." />
          <Button label="Save changes" onPress={save} loading={p.saveStatus === 'loading'} disabled={!dirty || hasErrors(errors)} fullWidth />
        </Card>
      </View>
      <MenuSection
        title="Security"
        items={[
          account.find(x => x.key === 'password') as MenuItem,
          account.find(x => x.key === 'notifications') as MenuItem,
        ]}
      />
    </>
  );

  return (
    <ScreenShell
      headerScrolls
      onBack={canGoBack && !asTab ? back : undefined}
      headerRight={<IconButton icon="settings-outline" onPress={() => dispatch(setProfileTab('settings'))} accessibilityLabel="Settings" />}
      headerContent={hero}>
      <SegmentTabs options={tabs} value={tab} onChange={k => dispatch(setProfileTab(k))} accessibilityLabel="Profile" />
      {p.error.message && !p.deleteOpen ? <InlineNotice message={p.error.message} /> : null}
      {tab === 'overview' ? overview : tab === 'addresses' ? addresses : settings}

      <Sheet
        visible={p.deleteOpen}
        onClose={() => dispatch(closeDelete())}
        title="Delete your account?"
        subtitle="Your profile, orders and any business application are removed. This cannot be undone."
        footer={<Button label="Delete account" variant="destructive" onPress={confirmDelete} loading={p.deleteStatus === 'loading'} disabled={!deleteReady} fullWidth />}>
        {p.error.message && p.deleteOpen ? <InlineNotice message={p.error.message} /> : null}
        <TextField
          label={googleOnly ? 'Type DELETE to confirm' : 'Enter your password to confirm'}
          mode={googleOnly ? 'text' : 'password'}
          value={p.deleteConfirmation}
          onChangeText={v => dispatch(setDeleteConfirmation(v))}
          autoCapitalize={googleOnly ? 'characters' : 'none'}
          returnKeyType="go"
          onSubmitEditing={confirmDelete}
        />
      </Sheet>
    </ScreenShell>
  );
};

export default ProfileScreen;
