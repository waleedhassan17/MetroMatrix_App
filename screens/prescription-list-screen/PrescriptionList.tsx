// ═══════════════════════════════════════════════════════
// MetroMatrix — Prescriptions
// ═══════════════════════════════════════════════════════
// Every prescription from a visit, newest first: diagnosis, doctor, date,
// and who it was for.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBack } from '../../hooks/useBack';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { PageHeader } from '../../Custom-Components/index';
import type { AccountStackParamList } from '../../models';
import { PrescriptionRows } from './PrescriptionRows';

type Props = NativeStackScreenProps<AccountStackParamList, 'PrescriptionList'>;

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
  });

const PrescriptionList: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <PrescriptionListContent {...props} />
  </ServiceScope>
);

const PrescriptionListContent: React.FC<Props> = () => {
  const { back, canGoBack } = useBack({ name: 'HealthTabs', params: { screen: 'HealthProfileTab' } });
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.root}>
      <PageHeader title="Prescriptions" subtitle="From your visits, newest first" onBack={canGoBack ? back : undefined} />
      <PrescriptionRows />
    </View>
  );
};

export default PrescriptionList;
