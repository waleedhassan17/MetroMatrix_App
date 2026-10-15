// MetroMatrix — Verify Success: where the email's verification link lands.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, InlineNotice, IonIcon, SkeletonLines } from '@custom/index';
import { AuthHeader, AuthScreen } from '@components/auth/AuthChrome';
import type { RootStackParamList } from '@/types';
import { selectVerifySuccess, verifyLinkAsync } from './verifySuccessSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifySuccess'>;

const makeStyles = ({ size, radius }: Theme) =>
  StyleSheet.create({
    hero: {
      alignSelf: 'center',
      width: size.avatar.xl,
      height: size.avatar.xl,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

const VerifySuccessScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  const s = useAppSelector(selectVerifySuccess);
  const token = route.params?.token;

  useEffect(() => {
    if (token) dispatch(verifyLinkAsync(token));
  }, [token, dispatch]);

  const ok = s.status === 'succeeded';
  const failed = s.status === 'failed' || !token;

  return (
    <AuthScreen>
      <View style={[styles.hero, { backgroundColor: failed ? colors.dangerSoft : service.accentSoft }]}>
        <IonIcon name={failed ? 'close-circle-outline' : 'checkmark-circle-outline'} size="xl" color={failed ? colors.danger : service.accent} />
      </View>
      <AuthHeader
        hideLogo
        title={failed ? "We couldn't verify that link" : ok ? 'Email Verified' : 'Verifying your email'}
        subtitle={
          failed
            ? 'Request a new link from the verification screen.'
            : ok && s.signedIn
              ? 'Taking you to the next step...'
              : ok
                ? 'Your email is verified. Sign in to continue.'
                : 'One moment.'
        }
      />
      {s.status === 'loading' ? <SkeletonLines lines={2} /> : null}
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      {(ok && !s.signedIn) || failed ? (
        <Button label="Continue to Sign In" onPress={() => navigation.navigate('SignIn')} fullWidth />
      ) : null}
      {ok && s.signedIn ? (
        <AppText variant="small" tone="muted" align="center">
          If nothing happens, close and reopen the app.
        </AppText>
      ) : null}
    </AuthScreen>
  );
};

export default VerifySuccessScreen;
