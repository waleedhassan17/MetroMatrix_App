// ═══════════════════════════════════════════════════════
// MetroMatrix — Where a Health tap goes (the patient's screens)
// ═══════════════════════════════════════════════════════
// The Health screens push over the Health app's tabs (the FYP's), so these
// push in the Health stack; Appointments is one of its tabs.

import { useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HealthBrowseParamList } from '../types';

type HealthNav = NativeStackNavigationProp<HealthBrowseParamList>;

export const useHealthNav = () => {
  const navigation = useNavigation<HealthNav>();
  return useMemo(
    () => ({
      navigation,
      openDoctor: (id: string, opts: Omit<HealthBrowseParamList['DoctorProfile'], 'id'> = {}) => navigation.push('DoctorProfile', { id, ...opts }),
      openDoctors: (params: NonNullable<HealthBrowseParamList['DoctorList']>) => navigation.push('DoctorList', params),
      openAppointment: (code: string) => navigation.navigate('AppointmentDetail', { code }),
      openSearch: () => navigation.navigate('HealthSearch'),
      openPrescription: (id: string) => navigation.navigate('PrescriptionView', { id }),
      /** Health's Appointments tab (Upcoming / Past). */
      openAppointments: (visits: 'upcoming' | 'past' = 'upcoming') =>
        (navigation as unknown as { navigate: (name: string, p?: object) => void }).navigate('HealthTabs', {
          screen: 'AppointmentsTab',
          params: { visits },
        }),
    }),
    [navigation],
  );
};
