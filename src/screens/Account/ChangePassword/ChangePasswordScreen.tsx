// ═══════════════════════════════════════════════════════
// MetroMatrix — Change password / set a first password
// ═══════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';
import type { TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { hasErrors, validateChangePassword } from '@models/authModel';
import { visibleErrors } from '@utils/formErrors';
import { haptics } from '@utils/haptics';
import { PageHeaderScope } from '@theme/index';
import { Button, Card, InlineNotice, PasswordStrength, ScreenShell, TextField } from '@custom/index';
import type { AccountStackParamList } from '@/types';
import { selectUser } from '../../Auth/authSlice';
import { changePasswordAsync, resetChangePassword, selectChangePassword, setField, touch } from './changePasswordSlice';

type Props = NativeStackScreenProps<AccountStackParamList, 'ChangePassword'>;

const ChangePasswordScreen: React.FC<Props> = props => (
  <PageHeaderScope>
    <ChangePasswordContent {...props} />
  </PageHeaderScope>
);

const ChangePasswordContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'Profile' });
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const s = useAppSelector(selectChangePassword);
  const newRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const requireCurrent = user?.hasPassword !== false;

  useEffect(
    () => () => {
      dispatch(resetChangePassword());
    },
    [dispatch],
  );

  const errors = validateChangePassword(s.values, requireCurrent);
  const shown = visibleErrors(errors, s.touched);

  const submit = async () => {
    if (hasErrors(errors) || s.status === 'loading') return;
    const r = await dispatch(
      changePasswordAsync({
        currentPassword: requireCurrent ? s.values.currentPassword : undefined,
        newPassword: s.values.password,
      }),
    );
    if (changePasswordAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({
        type: 'success',
        text1: requireCurrent ? 'Password changed' : 'Password set',
        text2: 'Your other devices have been signed out.',
      });
      back();
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title={requireCurrent ? 'Change password' : 'Set a password'}
      subtitle={
        requireCurrent
          ? 'Use 8–72 characters with an upper-case letter, a lower-case letter and a number.'
          : "Add a password so you can also sign in with your email. You'll confirm with Google first."
      }
      onBack={back}
      footer={
        <Button
          label={requireCurrent ? 'Change password' : 'Set password'}
          onPress={submit}
          loading={s.status === 'loading'}
          disabled={hasErrors(errors)}
          fullWidth
          size="lg"
        />
      }>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      <Card>
        {requireCurrent ? (
          <TextField
            label="Current password"
            mode="password"
            value={s.values.currentPassword}
            onChangeText={value => dispatch(setField({ field: 'currentPassword', value }))}
            onBlur={() => dispatch(touch('currentPassword'))}
            error={shown.currentPassword}
            autoComplete="current-password"
            returnKeyType="next"
            onSubmitEditing={() => newRef.current?.focus()}
            submitBehavior="submit"
          />
        ) : null}
        <TextField
          ref={newRef}
          label="New password"
          mode="password"
          value={s.values.password}
          onChangeText={value => dispatch(setField({ field: 'password', value }))}
          onBlur={() => dispatch(touch('password'))}
          error={shown.password}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          submitBehavior="submit"
        />
        <PasswordStrength password={s.values.password} />
        <TextField
          ref={confirmRef}
          label="Confirm new password"
          mode="password"
          value={s.values.confirmPassword}
          onChangeText={value => dispatch(setField({ field: 'confirmPassword', value }))}
          onBlur={() => dispatch(touch('confirmPassword'))}
          error={shown.confirmPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </Card>
    </ScreenShell>
  );
};

export default ChangePasswordScreen;
