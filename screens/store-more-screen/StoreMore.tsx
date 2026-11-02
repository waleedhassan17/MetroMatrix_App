// ═══════════════════════════════════════════════════════
// MetroMatrix — More (every store tool beyond the tabs)
// ═══════════════════════════════════════════════════════
// Stateless: a menu, as the FYP's profile pages are: the store at the top
// (its mark, name and a way to its profile), then Your store · Catalogue ·
// Customers · Account under overline titles, each row in its own categorical
// colour, and Sign out in red.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSignOut } from '../../hooks/useSignOut';
import { useAppSelector } from '../../hooks/useReduxHooks';
import { ServiceScope, useStyles, useTheme, type RowTint, type Theme } from '../../theme/index';
import { AppText, Card, ListRow, ScreenShell, StoreMark, TextAction, type IonName } from '../../Custom-Components/index';
import { ToolSection } from '../../Components/admin/AdminParts';
import { selectBusiness } from '../../store/authSlice';
import { selectStoreToday } from '../store-today-screen/storeTodaySlice';

type Nav = { navigate: (name: string, params?: object) => void };

interface Item {
  label: string;
  hint?: string;
  icon: IonName;
  tint: RowTint;
  to: string;
}

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Your store',
    items: [
      { label: 'Settings', hint: 'Delivery, returns, cash on delivery, pause', icon: 'settings-outline', tint: 'grey', to: 'StoreSettings' },
      { label: 'Payment accounts', hint: 'Where customers send transfers', icon: 'card-outline', tint: 'blue', to: 'PaymentAccounts' },
    ],
  },
  {
    title: 'Catalogue',
    items: [
      { label: 'Inventory', hint: 'Stock for every size and colour', icon: 'layers-outline', tint: 'blue', to: 'Inventory' },
      { label: 'Collections', hint: 'The shelves on your store page', icon: 'albums-outline', tint: 'violet', to: 'Collections' },
      { label: 'Coupons', hint: 'Codes customers use at checkout', icon: 'pricetag-outline', tint: 'rose', to: 'Coupons' },
    ],
  },
  {
    title: 'Customers',
    items: [
      { label: 'Returns', hint: 'Requests and refunds', icon: 'return-down-back-outline', tint: 'amber', to: 'StoreReturns' },
      { label: 'Reviews', hint: 'What buyers said, and your replies', icon: 'star-outline', tint: 'amber', to: 'StoreReviews' },
      { label: 'Insights', hint: 'Recorded sales and best sellers', icon: 'stats-chart-outline', tint: 'violet', to: 'Insights' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Notifications', icon: 'notifications-outline', tint: 'rose', to: 'Notifications' },
      { label: 'My account', hint: 'Name, phone, password', icon: 'person-circle-outline', tint: 'blue', to: 'Profile' },
    ],
  },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    identity: { flexDirection: 'row', alignItems: 'center', gap: space.s16 },
    identityText: { flex: 1, gap: space.s4 },
  });

const StoreMore: React.FC = () => (
  <ServiceScope service="shopping">
    <StoreMoreContent />
  </ServiceScope>
);

const StoreMoreContent: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const navigation = useNavigation<Nav>();
  const business = useAppSelector(selectBusiness);
  const summary = useAppSelector(selectStoreToday).summary;
  const { confirmSignOut } = useSignOut();
  const name = summary?.storeName ?? business?.name ?? 'Your store';
  return (
    <ScreenShell title="More" subtitle={name}>
      <Card>
        <View style={styles.identity}>
          <StoreMark
            store={{ name, logoUrl: summary?.logoUrl ?? null, brandColor: summary?.brandColor ?? service.accent, onBrandColor: summary?.onBrandColor }}
            size="lg"
          />
          <View style={styles.identityText}>
            <AppText variant="title" numberOfLines={1}>
              {name}
            </AppText>
            <AppText variant="small" tone="muted">
              {summary ? (summary.isPaused ? 'Taking a break' : 'Open for orders') : 'Your store on MetroMatrix'}
            </AppText>
            <TextAction label="Edit store profile" icon="create-outline" onPress={() => navigation.navigate('StoreProfile')} />
          </View>
        </View>
      </Card>
      {SECTIONS.map(section => (
        <ToolSection
          key={section.title}
          title={section.title}
          tools={section.items.map(it => ({
            key: it.to,
            title: it.label,
            subtitle: it.hint,
            icon: it.icon,
            tint: it.tint,
            onPress: () => navigation.navigate(it.to),
          }))}
        />
      ))}
      <Card padded="horizontal">
        <ListRow title="Sign out" leftIcon="log-out-outline" tint="red" onPress={confirmSignOut} chevron={false} />
      </Card>
    </ScreenShell>
  );
};

export default StoreMore;
