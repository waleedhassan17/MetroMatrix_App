// ═══════════════════════════════════════════════════════
// MetroMatrix — Set up authenticator
// ═══════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { authErrorMessage } from '../../Components/auth/authErrorMessage';
import { OTP_LENGTH } from '../../models/authModel';
import { haptics } from '../../utils/haptics/haptics';
import { PALETTES, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  Card,
  Checkbox,
  InlineNotice,
  OtpInput,
  ScreenShell,
  Skeleton,
  SkeletonLines,
} from '../../Custom-Components/index';
import { endPendingTotp, selectPendingTotp } from '../../store/authSlice';
import {
  confirmAsync,
  loadEnrolmentAsync,
  markCodesCopied,
  resetEnrol,
  selectAdminTwoFactorEnrol,
  setCode,
  finishEnrolAsync,
} from './adminTwoFactorEnrolSlice';

const makeStyles = ({ space, radius, size, colors }: Theme) =>
  StyleSheet.create({
    // QR codes scan dark-on-light, so the plate stays light in dark mode too.
    qrPlate: {
      alignSelf: 'center',
      padding: space.s16,
      borderRadius: radius.md,
      backgroundColor: PALETTES.light.surface,
    },
    secret: {
      padding: space.s12,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceSunk,
      alignItems: 'center',
    },
    keyActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.s8 },
    codes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    code: {
      width: '47%',
      paddingVertical: space.s8,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceSunk,
      alignItems: 'center',
      minHeight: size.control.sm,
      justifyContent: 'center',
    },
  });

/** "JBSWY3DPEHPK3PXP" → "JBSW Y3DP EHPK 3PXP" — easier to type by hand. */
const groupSecret = (secret: string) => secret.replace(/(.{4})/g, '$1 ').trim();

const AdminTwoFactorEnrol: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const pendingTotp = useAppSelector(selectPendingTotp);
  const s = useAppSelector(selectAdminTwoFactorEnrol);
  const challengeToken = pendingTotp?.challengeToken;

  useEffect(() => {
    if (challengeToken) dispatch(loadEnrolmentAsync(challengeToken));
    return () => {
      dispatch(resetEnrol());
    };
  }, [challengeToken, dispatch]);

  const confirm = async (code = s.code) => {
    if (!challengeToken || code.length !== OTP_LENGTH || s.confirmStatus === 'loading') return;
    const r = await dispatch(confirmAsync({ challengeToken, code }));
    if (confirmAsync.fulfilled.match(r)) haptics.success();
    else haptics.warning();
  };

  const copyCodes = async () => {
    await Clipboard.setStringAsync(s.recoveryCodes.join('\n'));
    dispatch(markCodesCopied());
    Toast.show({ type: 'success', text1: 'Recovery codes copied', text2: 'Keep them somewhere safe and offline.' });
  };

  const finish = () => {
    if (!s.session) return;
    void dispatch(finishEnrolAsync());
  };

  // Back to Sign In (not Onboarding): dropping the challenge moves the gate there.
  const cancel = () => dispatch(endPendingTotp());

  // On the same phone as the authenticator, the QR can't be scanned: copy the key, or hand the link over.
  const copyKey = async () => {
    if (!s.enrolment) return;
    await Clipboard.setStringAsync(s.enrolment.secret);
    Toast.show({ type: 'success', text1: 'Setup key copied', text2: 'Paste it into your authenticator app.' });
  };
  const openAuthenticator = async () => {
    if (!s.enrolment) return;
    try {
      await Linking.openURL(s.enrolment.otpauthUrl);
    } catch {
      Toast.show({ type: 'info', text1: 'No authenticator app opened it', text2: 'Copy the setup key and add it by hand.' });
    }
  };

  // ─── Step 2: recovery codes, shown once ────────────
  if (s.session) {
    return (
      <ScreenShell
        eyebrow="Step 2 of 2"
        title="Save your recovery codes"
        subtitle="Each code signs you in once if you lose your phone. You won't see them again."
        footer={<Button label="I've saved them" onPress={finish} disabled={!s.codesCopied} fullWidth size="lg" />}>
        <Card>
          <View style={styles.codes} accessibilityRole="list" accessibilityLabel="Recovery codes">
            {s.recoveryCodes.map(code => (
              <View key={code} style={styles.code}>
                <AppText variant="bodyStrong" selectable>
                  {code}
                </AppText>
              </View>
            ))}
          </View>
          <Button label="Copy all codes" leftIcon="copy-outline" variant="secondary" onPress={copyCodes} fullWidth />
        </Card>
        <Checkbox
          checked={s.codesCopied}
          onToggle={v => v && dispatch(markCodesCopied())}
          label="I've stored these codes somewhere safe."
          accessibilityLabel="I have stored my recovery codes"
        />
      </ScreenShell>
    );
  }

  // ─── Step 1: scan, then confirm a code ─────────────
  return (
    <ScreenShell
      eyebrow="Step 1 of 2"
      title="Set up your authenticator"
      subtitle="Staff accounts need two-step verification. Scan the code with Google Authenticator, 1Password or similar."
      onBack={cancel}
      footer={
        <Button
          label="Confirm code"
          onPress={() => confirm()}
          loading={s.confirmStatus === 'loading'}
          disabled={s.code.length !== OTP_LENGTH || !s.enrolment}
          fullWidth
          size="lg"
        />
      }>
      {s.error.message ? <InlineNotice message={authErrorMessage(s.error)} /> : null}
      <Card>
        {s.enrolment ? (
          <>
            <View style={styles.qrPlate} accessible accessibilityLabel="QR code for your authenticator app">
              <QRCode
                value={s.enrolment.otpauthUrl}
                size={size.qr}
                color={PALETTES.light.ink}
                backgroundColor={PALETTES.light.surface}
              />
            </View>
            <AppText variant="small" tone="muted" align="center">
              {"Can't scan? Enter this key instead:"}
            </AppText>
            <View style={styles.secret}>
              <AppText variant="bodyStrong" selectable accessibilityLabel={`Setup key ${s.enrolment.secret}`}>
                {groupSecret(s.enrolment.secret)}
              </AppText>
            </View>
            <View style={styles.keyActions}>
              <Button label="Copy setup key" variant="secondary" size="sm" leftIcon="copy-outline" onPress={() => void copyKey()} />
              {Platform.OS !== 'web' ? (
                <Button label="Open in authenticator" variant="ghost" size="sm" onPress={() => void openAuthenticator()} />
              ) : null}
            </View>
          </>
        ) : s.loadStatus === 'failed' ? (
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => challengeToken && dispatch(loadEnrolmentAsync(challengeToken))}
          />
        ) : (
          <>
            <Skeleton height={size.qr} shape="md" />
            <SkeletonLines lines={2} />
          </>
        )}
      </Card>
      <Card>
        <AppText variant="title">Enter the 6-digit code it shows</AppText>
        <OtpInput
          value={s.code}
          onChange={v => dispatch(setCode(v))}
          onComplete={confirm}
          error={!!s.error.message}
          disabled={!s.enrolment || s.confirmStatus === 'loading'}
          autoFocus={false}
          accessibilityLabel="Authenticator code"
        />
      </Card>
      <Button label="Cancel sign-in" variant="ghost" size="sm" onPress={cancel} />
    </ScreenShell>
  );
};

export default AdminTwoFactorEnrol;
