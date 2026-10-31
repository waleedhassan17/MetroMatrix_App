// ═══════════════════════════════════════════════════════
// MetroMatrix — Health → Appointments (a tab, as in the FYP)
// ═══════════════════════════════════════════════════════
// Upcoming (soonest first) or Past, each visit with its one action now
// (join, pay, directions, rate). A visit opens over the tabs.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { APPOINTMENT_SEGMENTS } from '../../../../models/health/appointmentStatusModel';
import { useStyles, type Theme } from '../../../../theme/index';
import { ChoiceChip, ScreenShell } from '../../../../Custom-Components/index';
import type { HealthTabParamList } from '../../../../types';
import { Appointments } from '../../../Customer/Orders/OrdersLists';
import { selectOrdersView, setVisitsSegment } from '../../../Customer/Orders/ordersSlice';

type Props = BottomTabScreenProps<HealthTabParamList, 'AppointmentsTab'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', gap: space.s8 },
  });

const HealthAppointmentsScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { visits } = useAppSelector(selectOrdersView);
  const asked = route.params?.visits;

  useEffect(() => {
    if (asked) dispatch(setVisitsSegment(asked));
  }, [asked, dispatch]);

  const go = navigation as unknown as { navigate: (name: string, params?: object) => void };

  return (
    <ScreenShell title="Appointments" subtitle="Your upcoming and past visits" scroll={false}>
      <View style={styles.chips}>
        {APPOINTMENT_SEGMENTS.map(sg => (
          <ChoiceChip key={sg.key} label={sg.label} selected={visits === sg.key} onPress={() => dispatch(setVisitsSegment(sg.key))} />
        ))}
      </View>
      <Appointments segment={visits} onOpen={code => go.navigate('AppointmentDetail', { code })} onFind={() => navigation.navigate('HealthHomeTab')} />
    </ScreenShell>
  );
};

export default HealthAppointmentsScreen;
