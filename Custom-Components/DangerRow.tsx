// DangerRow — the ONE way a form ends something for good (delete a dish,
// end a subscription, remove a supplier): a quiet danger-toned row at the
// foot of the page that asks before it acts. `confirm` words the question;
// the action runs only on "Yes".

import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { Alert } from '../utils/alert/alert';
import { AppText } from './AppText';
import { IonIcon, type IonName } from './Icon';

export interface DangerRowProps {
  label: string;
  onConfirm: () => void;
  /** The question, and its button ("Delete"). Without it the row acts at once. */
  confirm?: { title: string; message?: string; action: string };
  icon?: IonName;
  disabled?: boolean;
}

const makeStyles = ({ space, size }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s8, minHeight: size.touch, paddingHorizontal: space.s12 },
  });

export const DangerRow: React.FC<DangerRowProps> = ({ label, onConfirm, confirm, icon = 'trash-outline', disabled }) => {
  const styles = useStyles(makeStyles);
  const { colors, opacity } = useTheme();
  const press = () => {
    if (!confirm) return onConfirm();
    Alert.alert(confirm.title, confirm.message ?? '', [
      { text: 'Not now', style: 'cancel' },
      { text: confirm.action, style: 'destructive', onPress: onConfirm },
    ]);
  };
  return (
    <Pressable
      onPress={press}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, (pressed || disabled) && { opacity: disabled ? opacity.disabled : opacity.pressed }]}>
      <IonIcon name={icon} size="md" color={colors.danger} />
      <AppText variant="bodyStrong" tone="danger">
        {label}
      </AppText>
    </Pressable>
  );
};

export default DangerRow;
