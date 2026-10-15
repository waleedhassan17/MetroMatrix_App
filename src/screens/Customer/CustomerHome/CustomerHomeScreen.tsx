// ═══════════════════════════════════════════════════════
// MetroMatrix — Customer home (the FYP's user home, premium)
// ═══════════════════════════════════════════════════════
// The FYP's frame — the brand centred between two header wells, a "Live
// services" badge, "Our Services" with its count and one photo card per
// service — with a greeting, the launch offer and a trust strip around it.
// A launcher's job is to launch: Food opens the Food app, Health and
// Shopping open what is coming. The shell wears MetroMatrix emerald; each
// card wears its own service's colour.
// Stateless: opening a service records it in preferences.lastService.

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { setLastService } from '@store/preferencesSlice';
import { SERVICE_PALETTES, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, LiveDot } from '@custom/index';
import { ServiceCard, type ServiceCardData } from '@components/home/ServiceCard';
import { SERVICE_CARDS } from '@components/home/serviceCatalog';
import { HomeGreeting, HomeHeader, HomeSpotlight, HomeTrust } from '@components/home/HomeParts';
import type { HomeStackParamList } from '@/types';
import { selectUser } from '../../Auth/authSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'CustomerHome'>;

const FOOD = SERVICE_PALETTES.light.food;
const FOOD_CARD = SERVICE_CARDS.find(c => c.service === 'food');

const makeStyles = ({ colors, space, gutter, radius }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingBottom: space.s40, gap: space.s24 },
    sectionHead: { paddingHorizontal: gutter, gap: space.s12 },
    sectionRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    live: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      paddingHorizontal: space.s12,
      paddingVertical: space.s4 + space.s4 / 2,
      borderRadius: radius.pill,
    },
    count: {
      paddingHorizontal: space.s12,
      paddingVertical: space.s4 + space.s4 / 2,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSunk,
    },
    cards: { paddingHorizontal: gutter, gap: space.s20 },
  });

const CustomerHomeScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAppSelector(selectUser);
  const firstName = user?.name ? user.name.split(' ')[0] : null;
  const area = [user?.streetAddress, user?.city].filter(Boolean).join(', ') || null;

  const open = (card: Pick<ServiceCardData, 'service'>) => {
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
          onNotifications={() => Toast.show({ type: 'info', text1: "You're all caught up", text2: 'No new notifications.' })}
        />

        <HomeGreeting firstName={firstName} area={area} />

        {FOOD_CARD?.image ? (
          <HomeSpotlight
            image={FOOD_CARD.image}
            eyebrow="LAUNCH OFFER · FOOD"
            title="Free delivery on your first 3 orders"
            code="METRO3"
            accent={FOOD.accent}
            onAccent={FOOD.onAccent}
            onPress={() => open({ service: 'food' })}
          />
        ) : null}

        <View style={styles.sectionHead}>
          <View style={[styles.live, { backgroundColor: service.accentSoft }]}>
            <LiveDot color={colors.danger} />
            <AppText variant="micro" tone="accentDeep">
              LIVE SERVICES
            </AppText>
          </View>
          <View style={styles.sectionRow}>
            <View>
              <AppText variant="h1" accessibilityRole="header">
                Our Services
              </AppText>
              <AppText variant="body" tone="muted">
                Choose what you need
              </AppText>
            </View>
            <View style={styles.count}>
              <AppText variant="small" tone="muted">
                {SERVICE_CARDS.length} Available
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.cards}>
          {SERVICE_CARDS.map(card => (
            <ServiceCard key={card.service} data={card} onPress={() => open(card)} />
          ))}
        </View>

        <HomeTrust />
      </ScrollView>
    </View>
  );
};

export default CustomerHomeScreen;
