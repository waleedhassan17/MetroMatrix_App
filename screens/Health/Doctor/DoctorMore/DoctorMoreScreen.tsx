// ═══════════════════════════════════════════════════════
// MetroMatrix — More (every practice tool beyond the tabs)
// ═══════════════════════════════════════════════════════
// Stateless: a menu. Your practice · Patients' view · Account.

import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSignOut } from '../../../../hooks/useSignOut';
import { useAppSelector } from '../../../../hooks/useReduxHooks';
import { ServiceScope } from '../../../../theme/index';
import { AppText, Card, Divider, ListRow, ScreenShell, type IonName } from '../../../../Custom-Components/index';
import { selectBusiness } from '../../../Auth/authSlice';

type Nav = { navigate: (name: string, params?: object) => void };

interface Item {
  label: string;
  hint?: string;
  icon: IonName;
  to: string;
}

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Your practice',
    items: [
      { label: 'Practice setup', hint: 'The checklist patients need', icon: 'checkmark-done-outline', to: 'PracticeSetup' },
      { label: 'Availability', hint: 'Locations, weekly hours, preview', icon: 'time-outline', to: 'Availability' },
      { label: 'Time off', hint: 'Days you won’t see patients', icon: 'sunny-outline', to: 'TimeOff' },
      { label: 'Your profile', hint: 'Photo, qualifications, booking rules', icon: 'person-outline', to: 'DoctorProfileEdit' },
      { label: 'Payment accounts', hint: 'Where patients send transfers', icon: 'card-outline', to: 'PaymentAccounts' },
    ],
  },
  {
    title: 'Patients',
    items: [
      { label: 'Reviews', hint: 'Read and reply', icon: 'star-outline', to: 'MyReviews' },
      { label: 'Insights', hint: 'Appointments, wait times, recorded fees', icon: 'stats-chart-outline', to: 'DoctorInsights' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Notifications', icon: 'notifications-outline', to: 'Notifications' },
      { label: 'My account', hint: 'Name, phone, password', icon: 'person-circle-outline', to: 'Profile' },
    ],
  },
];

const DoctorMoreScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const business = useAppSelector(selectBusiness);
  const { confirmSignOut } = useSignOut();
  return (
    <ServiceScope service="healthcare">
      <ScreenShell title="More" subtitle={business?.name}>
        {SECTIONS.map(section => (
          <View key={section.title}>
            <AppText variant="micro" tone="muted">
              {section.title.toUpperCase()}
            </AppText>
            <Card padded="horizontal">
              {section.items.map((it, i) => (
                <View key={it.to}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow title={it.label} subtitle={it.hint} leftIcon={it.icon} onPress={() => navigation.navigate(it.to)} />
                </View>
              ))}
            </Card>
          </View>
        ))}
        <Card padded="horizontal">
          <ListRow title="Sign out" leftIcon="log-out-outline" onPress={confirmSignOut} chevron={false} />
        </Card>
      </ScreenShell>
    </ServiceScope>
  );
};

export default DoctorMoreScreen;
