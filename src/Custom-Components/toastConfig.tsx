// Toast config — react-native-toast-message rendered with tokens.
// Types: success · error · info. Pass to <Toast config={toastConfig} />.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ToastConfig, ToastConfigParams } from 'react-native-toast-message';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Tone = 'success' | 'error' | 'info';

const makeStyles = ({ colors, space, radius, elevation, gutter }: Theme) =>
  StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.s12,
      marginHorizontal: gutter,
      padding: space.s16,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      alignSelf: 'stretch',
      ...elevation.float,
    },
    text: { flex: 1, gap: space.s4 },
  });

const ToastCard: React.FC<ToastConfigParams<unknown> & { tone: Tone }> = ({ text1, text2, tone }) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const look: Record<Tone, { icon: IconName; color: string }> = {
    success: { icon: 'check-circle', color: colors.success },
    error: { icon: 'alert-circle', color: colors.danger },
    info: { icon: 'info', color: service.accent },
  };
  return (
    <View style={styles.root} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icon name={look[tone].icon} size="md" color={look[tone].color} />
      <View style={styles.text}>
        {text1 ? <AppText variant="bodyStrong">{text1}</AppText> : null}
        {text2 ? (
          <AppText variant="small" tone="muted">
            {text2}
          </AppText>
        ) : null}
      </View>
    </View>
  );
};

export const toastConfig: ToastConfig = {
  success: props => <ToastCard {...props} tone="success" />,
  error: props => <ToastCard {...props} tone="error" />,
  info: props => <ToastCard {...props} tone="info" />,
};

export default toastConfig;
