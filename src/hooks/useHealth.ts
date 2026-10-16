// ═══════════════════════════════════════════════════════
// MetroMatrix — Where a Health tap goes (the patient's screens)
// ═══════════════════════════════════════════════════════
// The Health screens after Health home exist in the Home, Orders and Profile
// stacks, so these push in the stack you are in.

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
      /** The Orders tab's Health segment (Upcoming / Past). */
      openAppointments: (visits: 'upcoming' | 'past' = 'upcoming') =>
        (navigation as unknown as { navigate: (name: string, p?: object) => void }).navigate('OrdersTab', {
          screen: 'Orders',
          params: { service: 'health', visits },
          // Keep the Orders stack's first screen under it, so back works.
          initial: false,
        }),
    }),
    [navigation],
  );
};
