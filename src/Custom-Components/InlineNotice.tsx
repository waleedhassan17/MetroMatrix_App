// InlineNotice — a message in the flow of a page or a form, with one
// optional action ("Go to partner sign-in"). Announced to screen readers.
//
// It is a white card like the others: a hairline border, ink text, and the
// tone carried only by a small tinted icon well — never a coloured fill or a
// coloured strip down its side.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { TextAction } from './TextAction';

export type NoticeTone = 'error' | 'info' | 'success' | 'warning';

export interface InlineNoticeProps {
  tone?: NoticeTone;
  title?: string;
  message: string;
  action?: { label: string; onPress: () => void };
}

const makeStyles = ({ colors, space, radius, size }: Theme) =>
  StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.s12,
      padding: space.s16,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: size.hairline,
      borderColor: colors.line,
    },
    well: { width: size.subTypeTile, height: size.subTypeTile, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1, gap: space.s4, alignItems: 'flex-start', justifyContent: 'center', minHeight: size.subTypeTile },
  });

export const InlineNotice: React.FC<InlineNoticeProps> = ({ tone = 'error', title, message, action }) => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const look: Record<NoticeTone, { bg: string; fg: string; icon: IconName }> = {
    error: { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle' },
    warning: { bg: colors.warningSoft, fg: colors.warning, icon: 'alert-triangle' },
    success: { bg: colors.successSoft, fg: colors.success, icon: 'check-circle' },
    info: { bg: service.accentSoft, fg: service.accentDeep, icon: 'info' },
  };
  const l = look[tone];
  return (
    <View style={styles.root} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={[styles.well, { backgroundColor: l.bg }]}>
        <Icon name={l.icon} size="md" color={l.fg} />
      </View>
      <View style={styles.body}>
        {title ? <AppText variant="bodyStrong">{title}</AppText> : null}
        <AppText variant={title ? 'small' : 'body'} tone={title ? 'muted' : 'ink'}>
          {message}
        </AppText>
        {action ? <TextAction label={action.label} onPress={action.onPress} /> : null}
      </View>
    </View>
  );
};

export default InlineNotice;
