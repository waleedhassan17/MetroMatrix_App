// ═══════════════════════════════════════════════════════
// MetroMatrix — Where a Health tap goes (the patient's screens)
// ═══════════════════════════════════════════════════════
// The Health screens push over the Health app's tabs (the FYP's), so these
// push in the Health stack; Appointments and Records are its tabs.

import { useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HealthBanner, HealthBrowseParamList, HealthTabParamList } from '../models';

type HealthNav = NativeStackNavigationProp<HealthBrowseParamList>;
type TabNav = { navigate: (name: 'HealthTabs', params: { screen: keyof HealthTabParamList; params?: object }) => void };

export const useHealthNav = () => {
  const navigation = useNavigation<HealthNav>();
  return useMemo(() => {
    const tab = (screen: keyof HealthTabParamList, params?: object) => (navigation as unknown as TabNav).navigate('HealthTabs', { screen, params });
    const openDoctors = (params: NonNullable<HealthBrowseParamList['DoctorList']>) => navigation.push('DoctorList', params);
    const openDoctor = (id: string, opts: Omit<HealthBrowseParamList['DoctorProfile'], 'id'> = {}) => navigation.push('DoctorProfile', { id, ...opts });
    return {
      navigation,
      openDoctor,
      openDoctors,
      openAppointment: (code: string) => navigation.navigate('AppointmentDetail', { code }),
      openSearch: () => navigation.navigate('HealthSearch'),
      openPrescription: (id: string) => navigation.navigate('PrescriptionView', { id }),
      /** Health's Appointments tab (Upcoming / Past). */
      openAppointments: (visits: 'upcoming' | 'past' = 'upcoming') => tab('AppointmentsTab', { visits }),
      /** Health's Records tab. */
      openRecords: () => tab('RecordsTab'),
      /** Where a home banner leads (the server only sends banners that lead somewhere). */
      openBanner: ({ target: t }: HealthBanner) => {
        switch (t.kind) {
          case 'specialty':
            return openDoctors({ specialty: t.slug, title: t.name });
          case 'condition':
            return openDoctors({ condition: t.slug, title: `Doctors who treat ${t.name}` });
          case 'doctor':
            return openDoctor(t.id, { name: t.name });
          case 'screen':
            switch (t.screen) {
              case 'video_consultation':
                return openDoctors({ kind: 'video', title: 'Video consultation' });
              case 'available_today':
                return openDoctors({ availableToday: true, title: 'Available today' });
              case 'symptom_checker':
                return navigation.navigate('SymptomChecker');
              case 'emergency':
                return navigation.navigate('Emergency');
              case 'records':
                return tab('RecordsTab');
            }
            return undefined;
          case 'none':
            return undefined;
        }
      },
    };
  }, [navigation]);
};
