// ═══════════════════════════════════════════════════════
// MetroMatrix — Customer home (the FYP's user home, premium)
// ═══════════════════════════════════════════════════════
// The FYP's frame and nothing more: the brand centred between the menu
// (which opens the side menu) and the bell, a "Live services" badge, "Our Services" with its count and one
// premium photo card per service. A launcher's job is to launch: each card
// opens that service's own app, with its own bottom tabs (the FYP's). The
// home has no bottom bar: its side menu opens orders, profile and the rest.
// The shell wears MetroMatrix emerald; each card wears its own service's
// colour.
// Stateless: opening a service records it in preferences.lastService.

import React, { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { useSignOut } from '../../../hooks/useSignOut';
import { useServiceNav } from '../../../hooks/useServiceNav';
import { APP_VERSION } from '../../../services/appInfo';
import { SUPPORT_EMAIL } from '../../../config/env';
import { markStoreSourceOpened, selectStoreSource, setLastService } from '../../../store/preferencesSlice';
import { storeToOpen } from '../../../models/kitchen/reachModel';
import { useStyles, useTheme, type Theme } from '../../../theme/index';
import { AppText, LiveDot } from '../../../Custom-Components/index';
import { ServiceCard, type ServiceCardData } from '../../../Components/home/ServiceCard';
import { SERVICE_CARDS } from '../../../Components/home/serviceCatalog';
import { HomeHeader } from '../../../Components/home/HomeParts';
import { SideMenu, type SideMenuSection } from '../../../Components/home/SideMenu';
import type { CustomerStackParamList } from '../../../types';
import { selectUser } from '../../Auth/authSlice';
import { loadUnreadCountAsync, selectUnreadCount } from '../../Account/Notifications/notificationsSlice';

type Props = NativeStackScreenProps<CustomerStackParamList, 'CustomerHome'>;

// The FYP home's measurements (userHome.tsx): 20 pt sides; the Live badge
// 16 pt under the header and 20 pt above the section; the section 16 pt
// above the cards; 16 pt between cards.
const makeStyles = ({ colors, space, radius }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingBottom: space.s40 },
    live: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      marginHorizontal: space.s20,
      marginTop: space.s16,
      marginBottom: space.s20,
      paddingHorizontal: space.s12 + space.s4 / 2,
      paddingVertical: space.s8,
      borderRadius: radius.xl,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.s20,
      marginBottom: space.s16,
    },
    count: {
      paddingHorizontal: space.s12 + space.s4 / 2,
      paddingVertical: space.s8,
      borderRadius: radius.xl,
      backgroundColor: colors.surfaceSunk,
    },
    cards: { paddingHorizontal: space.s20, gap: space.s16 },
  });

const CustomerHomeScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAppSelector(selectUser);
  const unread = useAppSelector(selectUnreadCount);

  // The bell's count, fresh whenever the home is shown.
  useFocusEffect(
    useCallback(() => {
      void dispatch(loadUnreadCountAsync());
    }, [dispatch]),
  );
  const { confirmSignOut } = useSignOut();
  const [menuOpen, setMenuOpen] = useState(false);
  const svc = useServiceNav();

  // Came through a kitchen's link or QR before signing in: its page opens
  // once, when the home is first shown (the navigator is ready by then).
  const storeSource = useAppSelector(selectStoreSource);
  useFocusEffect(
    useCallback(() => {
      const slug = storeToOpen(storeSource, Date.now());
      if (!slug) return;
      // Marked inside the timer: marking changes this effect, and its cleanup would cancel the jump.
      const t = setTimeout(() => {
        dispatch(markStoreSourceOpened());
        svc.openFood('FoodVendor', { slug });
      }, 0);
      return () => clearTimeout(t);
    }, [storeSource, dispatch, svc]),
  );

  const menu: SideMenuSection[] = [
    {
      title: 'Account',
      items: [
        {
          key: 'profile',
          label: 'My Profile',
          icon: 'person-circle-outline',
          onPress: () => navigation.navigate('Profile'),
        },
        {
          key: 'orders',
          label: 'My Orders',
          icon: 'receipt-outline',
          onPress: () => navigation.navigate('Orders'),
        },
        {
          key: 'saved',
          label: 'Saved',
          icon: 'heart-outline',
          onPress: () => svc.openShopTab('SavedTab'),
        },
        {
          key: 'addresses',
          label: 'Addresses',
          icon: 'location-outline',
          onPress: () => navigation.navigate('AddressBook'),
        },
        {
          key: 'appointments',
          label: 'Appointments',
          icon: 'calendar-outline',
          onPress: () => svc.openHealthTab('AppointmentsTab'),
        },
        {
          key: 'records',
          label: 'Health records',
          icon: 'folder-open-outline',
          onPress: () => svc.openHealthTab('RecordsTab'),
        },
        {
          key: 'family',
          label: 'Family members',
          icon: 'people-outline',
          onPress: () => svc.openHealth('FamilyMembers'),
        },
        {
          key: 'notifications',
          label: 'Notifications',
          icon: 'notifications-outline',
          onPress: () => navigation.navigate('Notifications'),
        },
        {
          key: 'password',
          label: 'Change Password',
          icon: 'lock-closed-outline',
          onPress: () => navigation.navigate('ChangePassword'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          key: 'help',
          label: 'Help & Support',
          icon: 'help-buoy-outline',
          onPress: () =>
            void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Help%20with%20MetroMatrix`),
        },
      ],
    },
  ];

  const open = (card: ServiceCardData) => {
    dispatch(setLastService(card.service));
    // Each service is its own app with its own tabs, as in the FYP.
    if (card.service === 'food') svc.openFood();
    else if (card.service === 'shopping') svc.openShop();
    else if (card.service === 'healthcare') svc.openHealth();
    else navigation.navigate('ServicePreview', { service: card.service });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <HomeHeader
          onMenu={() => setMenuOpen(true)}
          onNotifications={() => navigation.navigate('Notifications')}
          unread={unread}
        />

        <View style={[styles.live, { backgroundColor: service.accentSoft }]}>
          <LiveDot color={colors.danger} />
          <AppText variant="micro" tone="accentDeep">
            LIVE SERVICES
          </AppText>
        </View>

        <View style={styles.sectionHead}>
          <View>
            <AppText variant="heading" accessibilityRole="header">
              Our Services
            </AppText>
            <AppText variant="body" tone="muted">
              Choose what you need
            </AppText>
          </View>
          <View style={styles.count}>
            <AppText variant="chip" tone="muted">
              {SERVICE_CARDS.length} Available
            </AppText>
          </View>
        </View>

        <View style={styles.cards}>
          {SERVICE_CARDS.map(card => (
            <ServiceCard key={card.service} data={card} onPress={() => open(card)} />
          ))}
        </View>
      </ScrollView>

      <SideMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        name={user?.name ?? ''}
        email={user?.email ?? ''}
        avatarUrl={user?.avatarUrl}
        verified={!!user?.isEmailVerified}
        sections={menu}
        onSignOut={confirmSignOut}
        version={APP_VERSION}
      />
    </View>
  );
};

export default CustomerHomeScreen;
