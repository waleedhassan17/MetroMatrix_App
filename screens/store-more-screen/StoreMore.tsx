// ═══════════════════════════════════════════════════════
// MetroMatrix — More (every store tool beyond the tabs)
// ═══════════════════════════════════════════════════════
// Stateless: a menu. Your store · Catalogue · Customers · Numbers · Account.

import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSignOut } from '../../hooks/useSignOut';
import { useAppSelector } from '../../hooks/useReduxHooks';
import { ServiceScope } from '../../theme/index';
import { AppText, Card, Divider, ListRow, ScreenShell, type IonName } from '../../Custom-Components/index';
import { selectBusiness } from '../../store/authSlice';

type Nav = { navigate: (name: string, params?: object) => void };

interface Item {
  label: string;
  hint?: string;
  icon: IonName;
  to: string;
}

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Your store',
    items: [
      { label: 'Store profile', hint: 'Logo, cover, colours, story', icon: 'storefront-outline', to: 'StoreProfile' },
      { label: 'Settings', hint: 'Delivery, returns, cash on delivery, pause', icon: 'settings-outline', to: 'StoreSettings' },
      { label: 'Payment accounts', hint: 'Where customers send transfers', icon: 'card-outline', to: 'PaymentAccounts' },
    ],
  },
  {
    title: 'Catalogue',
    items: [
      { label: 'Inventory', hint: 'Stock for every size and colour', icon: 'layers-outline', to: 'Inventory' },
      { label: 'Collections', hint: 'The shelves on your store page', icon: 'albums-outline', to: 'Collections' },
      { label: 'Coupons', icon: 'pricetag-outline', to: 'Coupons' },
    ],
  },
  {
    title: 'Customers',
    items: [
      { label: 'Returns', icon: 'return-down-back-outline', to: 'StoreReturns' },
      { label: 'Reviews', icon: 'star-outline', to: 'StoreReviews' },
      { label: 'Insights', hint: 'Recorded sales and best sellers', icon: 'stats-chart-outline', to: 'Insights' },
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

const StoreMore: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const business = useAppSelector(selectBusiness);
  const { confirmSignOut } = useSignOut();
  return (
    <ServiceScope service="shopping">
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

export default StoreMore;
