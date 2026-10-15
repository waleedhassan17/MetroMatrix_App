// ═══════════════════════════════════════════════════════
// MetroMatrix — Customer home (the FYP's user home, premium)
// ═══════════════════════════════════════════════════════
// The FYP's frame and nothing more: the brand centred between two header
// wells, a "Live services" badge, "Our Services" with its count and one
// premium photo card per service. A launcher's job is to launch: the Food
// Court card opens the Food Court, Health and Shopping open what is coming. The shell wears MetroMatrix emerald; each
// card wears its own service's colour.
// Stateless: opening a service records it in preferences.lastService.

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { setLastService } from '@store/preferencesSlice';
import { useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, LiveDot } from '@custom/index';
import { ServiceCard, type ServiceCardData } from '@components/home/ServiceCard';
import { SERVICE_CARDS } from '@components/home/serviceCatalog';
import { HomeHeader } from '@components/home/HomeParts';
import type { HomeStackParamList } from '@/types';
import { selectUser } from '../../Auth/authSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'CustomerHome'>;

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

  const open = (card: ServiceCardData) => {
    dispatch(setLastService(card.service));
    if (card.service === 'food') navigation.navigate('FoodHome');
    else navigation.navigate('ServicePreview', { service: card.service });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <HomeHeader
          name={user?.name ?? ''}
          avatarUrl={user?.avatarUrl}
          onProfile={() => navigation.getParent()?.navigate('ProfileTab')}
          onNotifications={() =>
            Toast.show({
              type: 'info',
              text1: "You're all caught up",
              text2: 'No new notifications.',
            })
          }
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
    </View>
  );
};

export default CustomerHomeScreen;
