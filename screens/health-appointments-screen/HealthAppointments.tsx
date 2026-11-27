// ═══════════════════════════════════════════════════════
// MetroMatrix — Health → Appointments (a tab, as in the FYP)
// ═══════════════════════════════════════════════════════
// Upcoming (soonest first) or Past, each visit with its one action now
// (join, pay, directions, rate). A visit opens over the tabs.

import React, { useEffect } from 'react';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { APPOINTMENT_SEGMENTS } from '../../models/health/appointmentStatusModel';
import { ScreenShell, SegmentTabs } from '../../Custom-Components/index';
import type { HealthTabParamList } from '../../models';
import { Appointments } from '../orders-screen/OrdersLists';
import { selectOrdersView, setVisitsSegment } from '../orders-screen/ordersSlice';

type Props = BottomTabScreenProps<HealthTabParamList, 'AppointmentsTab'>;

const HealthAppointments: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const { visits } = useAppSelector(selectOrdersView);
  const asked = route.params?.visits;

  useEffect(() => {
    if (asked) dispatch(setVisitsSegment(asked));
  }, [asked, dispatch]);

  const go = navigation as unknown as { navigate: (name: string, params?: object) => void };

  return (
    <ScreenShell
      title="Appointments"
      subtitle="Your upcoming and past visits"
      scroll={false}
      headerContent={
        <SegmentTabs
          options={APPOINTMENT_SEGMENTS.map(sg => ({ key: sg.key, label: sg.label }))}
          value={visits}
          onChange={k => dispatch(setVisitsSegment(k))}
          accessibilityLabel="Appointments"
        />
      }>
      <Appointments segment={visits} onOpen={code => go.navigate('AppointmentDetail', { code })} onFind={() => navigation.navigate('HealthHomeTab')} />
    </ScreenShell>
  );
};

export default HealthAppointments;
