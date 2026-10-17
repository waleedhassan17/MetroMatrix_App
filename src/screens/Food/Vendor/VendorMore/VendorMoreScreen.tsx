// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: More (every kitchen tool beyond the tabs)
// ═══════════════════════════════════════════════════════
// Stateless: a menu. Your kitchen · How you work · Account.

import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSignOut } from '@hooks/useSignOut';
import { useAppSelector } from '@hooks/useReduxHooks';
import { KITCHEN_KIND_NAME } from '@models/food/vendorModel';
import { ServiceScope } from '@theme/index';
import { AppText, Card, Divider, ListRow, ScreenShell, type IonName } from '@custom/index';
import { selectBusiness } from '../../../Auth/authSlice';

type Nav = { navigate: (name: string, params?: object) => void };

interface Item {
  label: string;
  hint?: string;
  icon: IonName;
  to: string;
}

const MENU_ITEMS: Item[] = [
  { label: 'Categories', hint: 'The sections of your menu, in order', icon: 'albums-outline', to: 'VendorCategories' },
  { label: 'Add-on groups', hint: 'Spice level, toppings, drinks…', icon: 'options-outline', to: 'VendorOptionGroups' },
];

const HOME_KITCHEN_ITEMS: Item[] = [
  { label: 'Weekly menu', hint: 'The days you cook each dish', icon: 'calendar-outline', to: 'VendorWeeklyMenu' },
  { label: 'Pre-order slots', hint: 'When customers can order ahead for', icon: 'time-outline', to: 'VendorPreorderSlots' },
];

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Your kitchen',
    items: [
      { label: 'Kitchen setup', hint: 'The checklist customers need', icon: 'checkmark-done-outline', to: 'VendorSetup' },
      { label: 'Your brand', hint: 'Name, logo, cover, cuisines', icon: 'color-palette-outline', to: 'VendorBrand' },
      { label: 'Plan', hint: 'Community plan · no commission', icon: 'ribbon-outline', to: 'VendorPlan' },
    ],
  },
  {
    title: 'How you work',
    items: [
      { label: 'Kitchen settings', hint: 'Delivery, pick-up, cash, address', icon: 'options-outline', to: 'VendorSettings' },
      { label: 'Opening hours', hint: 'When customers can order', icon: 'time-outline', to: 'VendorHours' },
      { label: 'Delivery zones', hint: 'Fees and minimum order by distance', icon: 'navigate-circle-outline', to: 'VendorZones' },
      { label: 'Closed days', hint: 'Holidays and days off', icon: 'calendar-clear-outline', to: 'VendorClosures' },
      { label: 'Payment accounts', hint: 'Where customers send transfers', icon: 'card-outline', to: 'PaymentAccounts' },
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

const VendorMoreScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const business = useAppSelector(selectBusiness);
  const { confirmSignOut } = useSignOut();
  const kind = business?.subType === 'home_kitchen' || business?.subType === 'cloud_kitchen' ? business.subType : 'restaurant';
  const sections = [
    SECTIONS[0],
    { title: 'Your menu', items: kind === 'home_kitchen' ? [...MENU_ITEMS, ...HOME_KITCHEN_ITEMS] : MENU_ITEMS },
    ...SECTIONS.slice(1),
  ];
  return (
    <ServiceScope service="food">
      <ScreenShell title="More" subtitle={business ? `${business.name} · ${KITCHEN_KIND_NAME[kind]}` : undefined}>
        {sections.map(section => (
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

export default VendorMoreScreen;
