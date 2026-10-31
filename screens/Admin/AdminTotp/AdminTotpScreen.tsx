// ═══════════════════════════════════════════════════════
// MetroMatrix — Two-step verification (staff, after Sign In)
// ═══════════════════════════════════════════════════════

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { OTP_LENGTH } from '../../../models/authModel';
import { haptics } from '../../../utils/haptics';
import { useStyles, useTheme, type Theme } from '../../../theme/index';
import { AppText, Button, InlineNotice, IonIcon, OtpInput, TextField } from '../../../Custom-Components/index';
import { AuthHeader, AuthScreen } from '../../../Components/auth/AuthChrome';
import { selectPendingTotp, setPendingTotp } from '../../Auth/authSlice';
import { resetTotp, selectAdminTotp, setCode, setRecoveryCode, toggleRecovery, verifyTotpAsync } from './adminTotpSlice';

const makeStyles = ({ space, size, radius }: Theme) =>
  StyleSheet.create({
    hero: {
      alignSelf: 'center',
      width: size.avatar.xl,
      height: size.avatar.xl,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: { alignItems: 'center', gap: space.s4 },
  });

const AdminTotpScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const s = useAppSelector(selectAdminTotp);
  const pendingTotp = useAppSelector(selectPendingTotp);
  const loading = s.status === 'loading';
  const ready = s.useRecovery ? s.recoveryCode.trim().length >= 6 : s.code.length === OTP_LENGTH;

  const verify = async (code = s.code) => {
    if (!pendingTotp || loading) return;
    if (!s.useRecovery && code.length !== OTP_LENGTH) return;
    if (s.useRecovery && s.recoveryCode.trim().length < 6) return;
    const r = await dispatch(
      verifyTotpAsync(
        s.useRecovery
          ? { challengeToken: pendingTotp.challengeToken, recoveryCode: s.recoveryCode }
          : { challengeToken: pendingTotp.challengeToken, code },
      ),
    );
    if (verifyTotpAsync.rejected.match(r)) haptics.warning();
    else haptics.success();
  };

  // Back to Sign In: dropping the challenge moves the gate.
  const cancel = () => {
    dispatch(resetTotp());
    dispatch(setPendingTotp(null));
  };

  return (
    <AuthScreen onBack={cancel}>
      <View style={[styles.hero, { backgroundColor: service.accentSoft }]}>
        <IonIcon name="shield-checkmark-outline" size="xl" color={service.accent} />
      </View>
      <AuthHeader
        hideLogo
        title={s.useRecovery ? 'Use a Recovery Code' : 'Two-Step Verification'}
        subtitle={
          s.useRecovery
            ? 'Enter one of the recovery codes you saved when you set up your authenticator.'
            : `Enter the 6-digit code from your authenticator app for ${pendingTotp?.email ?? 'your account'}.`
        }
      />
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      {s.useRecovery ? (
        <TextField
          label="Recovery Code"
          icon="key-outline"
          value={s.recoveryCode}
          onChangeText={v => dispatch(setRecoveryCode(v))}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="ABCD-EFGH"
          returnKeyType="go"
          onSubmitEditing={() => verify()}
          autoFocus
        />
      ) : (
        <OtpInput
          value={s.code}
          onChange={v => dispatch(setCode(v))}
          onComplete={verify}
          error={!!s.error.message}
          disabled={loading}
          autoFocus
          accessibilityLabel="Authenticator code"
        />
      )}
      <Button label={loading ? 'Verifying...' : 'Verify'} onPress={() => verify()} disabled={!ready || loading} fullWidth />
      <View style={styles.center}>
        <Button
          label={s.useRecovery ? 'Use authenticator code instead' : 'Use a recovery code instead'}
          variant="ghost"
          onPress={() => dispatch(toggleRecovery())}
        />
        <Button label="Cancel sign-in" variant="ghost" size="sm" onPress={cancel} />
      </View>
    </AuthScreen>
  );
};

export default AdminTotpScreen;
