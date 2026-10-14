// ═══════════════════════════════════════════════════════
// MetroMatrix — Profile (every role's Profile tab)
// ═══════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useSignOut } from '@hooks/useSignOut';
import { hasErrors, nationalFromPkPhone, validateProfile } from '@models/authModel';
import { selectThemeMode, setThemeMode, type ThemeMode } from '@store/preferencesSlice';
import { visibleErrors } from '@utils/formErrors';
import { haptics } from '@utils/haptics';
import { pickImageFromLibrary } from '@utils/pickers';
import { useStyles, type Theme } from '@theme/index';
import {
  AppText,
  Avatar,
  Button,
  Card,
  Divider,
  InlineNotice,
  ListRow,
  ProgressBar,
  ScreenShell,
  SegmentTabs,
  Sheet,
  TextField,
} from '@custom/index';
import type { AccountStackParamList } from '@/types';
import { selectBusiness, selectUser } from '../../Auth/authSlice';
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
  touch,
  uploadAvatarAsync,
} from './profileSlice';

type Props = NativeStackScreenProps<AccountStackParamList, 'Profile'>;

const THEME_OPTIONS: { key: ThemeMode; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

const ROLE_LABEL: Record<string, string> = {
  customer: 'Customer',
  partner: 'Partner',
  admin: 'Admin',
  super_admin: 'Super admin',
};

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    header: { alignItems: 'center', gap: space.s8, paddingBottom: space.s8 },
    progress: { alignSelf: 'stretch' },
  });

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const user = useAppSelector(selectUser);
  const business = useAppSelector(selectBusiness);
  const themeMode = useAppSelector(selectThemeMode);
  const p = useAppSelector(selectProfile);
  const { confirmSignOut } = useSignOut();

  useEffect(() => {
    if (user && p.loadedFor !== user.id) dispatch(loadFromUser(user));
  }, [user, p.loadedFor, dispatch]);

  if (!user) return null;

  const errors = validateProfile({ name: p.name, phone: p.phone });
  const shown = visibleErrors(errors, p.touched);
  const dirty = p.name.trim() !== user.name || p.phone !== nationalFromPkPhone(user.phone);
  const googleOnly = !user.hasPassword;
  const deleteReady = googleOnly
    ? p.deleteConfirmation.trim() === 'DELETE'
    : p.deleteConfirmation.length > 0;

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
    const r = await dispatch(
      deleteAccountAsync(googleOnly ? { confirm: 'DELETE' } : { password: p.deleteConfirmation }),
    );
    if (deleteAccountAsync.fulfilled.match(r)) {
      Toast.show({
        type: 'success',
        text1: 'Account deleted',
        text2: 'Your data has been removed.',
      });
    } else haptics.warning();
  };

  return (
    <ScreenShell title="Profile">
      <View style={styles.header}>
        <Avatar
          name={user.name || user.email}
          uri={user.avatarUrl}
          size="xl"
          editable
          uploading={p.avatarStatus === 'loading'}
          onPress={changePhoto}
        />
        {p.avatarStatus === 'loading' ? (
          <View style={styles.progress}>
            <ProgressBar progress={p.avatarProgress} accessibilityLabel="Uploading photo" />
          </View>
        ) : null}
        <AppText variant="h2" align="center">
          {user.name || 'Your profile'}
        </AppText>
        <AppText variant="small" tone="muted" align="center">
          {[ROLE_LABEL[user.role], business?.name].filter(Boolean).join(' · ')}
        </AppText>
      </View>

      {p.error.message && !p.deleteOpen ? <InlineNotice message={p.error.message} /> : null}

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
        <TextField
          label="Email"
          mode="email"
          value={user.email}
          onChangeText={() => undefined}
          editable={false}
        />
        {dirty ? (
          <Button
            label="Save changes"
            variant="secondary"
            onPress={save}
            loading={p.saveStatus === 'loading'}
            disabled={hasErrors(errors)}
            fullWidth
          />
        ) : null}
      </Card>

      <Card>
        <AppText variant="micro" tone="muted">
          Appearance
        </AppText>
        <SegmentTabs
          options={THEME_OPTIONS}
          value={themeMode}
          onChange={mode => dispatch(setThemeMode(mode))}
          accessibilityLabel="Theme"
        />
      </Card>

      <Card padded="horizontal">
        <ListRow
          title={googleOnly ? 'Set a password' : 'Change password'}
          subtitle={
            googleOnly
              ? 'You sign in with Google. Add a password to sign in with email too.'
              : undefined
          }
          leftIcon="lock"
          onPress={() => navigation.navigate('ChangePassword')}
        />
        <Divider />
        <ListRow title="Sign out" leftIcon="log-out" onPress={confirmSignOut} chevron={false} />
        <Divider />
        <ListRow
          title="Delete account"
          leftIcon="trash-2"
          destructive
          chevron={false}
          onPress={() => dispatch(openDelete())}
        />
      </Card>

      <Sheet
        visible={p.deleteOpen}
        onClose={() => dispatch(closeDelete())}
        title="Delete your account?"
        subtitle="Your profile, orders and any business application are removed. This cannot be undone."
        footer={
          <Button
            label="Delete account"
            variant="destructive"
            onPress={confirmDelete}
            loading={p.deleteStatus === 'loading'}
            disabled={!deleteReady}
            fullWidth
          />
        }>
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
