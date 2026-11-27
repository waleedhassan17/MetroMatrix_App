// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: More (every kitchen tool beyond the tabs)
// ═══════════════════════════════════════════════════════
// Stateless: the kitchen's identity card, then tinted menus — your menu,
// your kitchen, how you work, account — and a red Sign out. Growth and the
// assistant live on the Kitchen tab (one row here leads there), so nothing
// is listed twice.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSignOut } from '../../hooks/useSignOut';
import { useAppSelector } from '../../hooks/useReduxHooks';
import { KITCHEN_KIND_NAME } from '../../models/food/vendorModel';
import { VENDOR_TRUST_LINE } from '../../models/food/trustModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Card, ListRow, ScreenShell, StoreMark, TextAction, type IonName } from '../../Custom-Components/index';
import { ToolSection } from '../../Components/admin/AdminParts';
import { TrustNote } from '../../Components/food/FoodParts';
import { selectBusiness } from '../../store/authSlice';
import { selectVendorBoard } from '../vendor-orders-screen/vendorBoardSlice';

type Nav = { navigate: (name: string, params?: object) => void };

interface Item {
  label: string;
  hint?: string;
  icon: IonName;
  to: string;
  params?: object;
}

const MENU_ITEMS: Item[] = [
  { label: 'Categories', hint: 'The sections of your menu, in order', icon: 'albums-outline', to: 'VendorCategories' },
  { label: 'Add-on groups', hint: 'Spice level, toppings, drinks…', icon: 'layers-outline', to: 'VendorOptionGroups' },
];

/** A home kitchen's Menu and Riders aren't tabs: they open from here. */
const HOME_KITCHEN_PAGES: Item[] = [
  { label: 'Menu', hint: 'Your dishes, and what can be ordered now', icon: 'book-outline', to: 'VendorMenuPage' },
  { label: 'Riders', hint: 'Your own delivery riders', icon: 'bicycle-outline', to: 'VendorRidersPage' },
];

const HOME_KITCHEN_ITEMS: Item[] = [
  { label: 'Weekly menu', hint: 'The days you cook each dish', icon: 'calendar-number-outline', to: 'VendorWeeklyMenu' },
  { label: 'Pre-order slots', hint: 'When customers can order ahead for', icon: 'alarm-outline', to: 'VendorPreorderSlots' },
];

const KITCHEN: Item[] = [
  { label: 'Kitchen setup', hint: 'The checklist customers need', icon: 'checkmark-done-outline', to: 'VendorSetup' },
  { label: 'Your brand', hint: 'Name, logo, cover, cuisines', icon: 'color-palette-outline', to: 'VendorBrand' },
  { label: 'Deals', hint: 'Offers you fund — one per order, the best one', icon: 'pricetag-outline', to: 'VendorPromotions' },
  { label: 'Reviews', hint: 'What customers say, and your replies', icon: 'chatbox-ellipses-outline', to: 'VendorReviews' },
  { label: 'Insights', hint: 'Recorded sales, acceptance, prep time', icon: 'stats-chart-outline', to: 'VendorInsights' },
  { label: 'Plan', hint: 'Community plan · no commission', icon: 'ribbon-outline', to: 'VendorPlan' },
  { label: 'Grow and the assistant', hint: 'Tiffins, dawat, your link, Ramadan, the assistant', icon: 'sparkles-outline', to: 'VendorTabs', params: { screen: 'KitchenTab' } },
];

const HOW_YOU_WORK: Item[] = [
  { label: 'Ordering and delivery', hint: 'Delivery, pick-up, cash, address', icon: 'settings-outline', to: 'VendorSettings' },
  { label: 'Opening hours', hint: 'When customers can order', icon: 'time-outline', to: 'VendorHours' },
  { label: 'Delivery zones', hint: 'Fees and minimum order by distance', icon: 'navigate-circle-outline', to: 'VendorZones' },
  { label: 'Closed days', hint: 'Holidays and days off', icon: 'calendar-clear-outline', to: 'VendorClosures' },
  { label: 'Payment accounts', hint: 'Where customers send transfers', icon: 'card-outline', to: 'PaymentAccounts' },
];

const ACCOUNT: Item[] = [
  { label: 'Notifications', icon: 'notifications-outline', to: 'Notifications' },
  { label: 'My account', hint: 'Name, phone, password', icon: 'person-circle-outline', to: 'Profile' },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    identity: { flexDirection: 'row', alignItems: 'center', gap: space.s16 },
    identityText: { flex: 1, gap: space.s4 },
  });

const VendorMore: React.FC = () => (
  <ServiceScope service="food">
    <VendorMoreContent />
  </ServiceScope>
);

const VendorMoreContent: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const navigation = useNavigation<Nav>();
  const business = useAppSelector(selectBusiness);
  const profile = useAppSelector(selectVendorBoard).profile;
  const { confirmSignOut } = useSignOut();
  const kind = business?.subType === 'home_kitchen' || business?.subType === 'cloud_kitchen' ? business.subType : 'restaurant';
  const name = profile?.name ?? business?.name ?? 'Your kitchen';
  const sections: { title: string; items: Item[] }[] = [
    { title: 'Your menu', items: kind === 'home_kitchen' ? [...HOME_KITCHEN_PAGES, ...MENU_ITEMS, ...HOME_KITCHEN_ITEMS] : MENU_ITEMS },
    { title: 'Your kitchen', items: KITCHEN },
    { title: 'How you work', items: HOW_YOU_WORK },
    { title: 'Account', items: ACCOUNT },
  ];
  return (
    <ScreenShell title="More" subtitle={`${name} · ${KITCHEN_KIND_NAME[kind]}`}>
      <Card>
        <View style={styles.identity}>
          <StoreMark store={{ name, logoUrl: profile?.logoUrl ?? null, brandColor: profile?.brandColor ?? service.accent }} size="lg" />
          <View style={styles.identityText}>
            <AppText variant="title" numberOfLines={1}>
              {name}
            </AppText>
            <AppText variant="small" tone="muted">
              {profile ? profile.branch.openState.label : KITCHEN_KIND_NAME[kind]}
            </AppText>
            <TextAction label="Edit your brand" icon="create-outline" onPress={() => navigation.navigate('VendorBrand')} />
          </View>
        </View>
      </Card>
      {sections.map(section => (
        <ToolSection
          key={section.title}
          title={section.title}
          tools={section.items.map(it => ({
            key: `${it.to}${it.params ? ':tab' : ''}`,
            title: it.label,
            subtitle: it.hint,
            icon: it.icon,
            onPress: () => navigation.navigate(it.to, it.params),
          }))}
        />
      ))}
      <Card padded="horizontal">
        <ListRow title="Sign out" leftIcon="log-out-outline" destructive onPress={confirmSignOut} chevron={false} />
      </Card>
      <TrustNote text={VENDOR_TRUST_LINE} />
    </ScreenShell>
  );
};

export default VendorMore;
