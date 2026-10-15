// ═══════════════════════════════════════════════════════
// MetroMatrix — Customer home (the FYP's user home)
// ═══════════════════════════════════════════════════════
// The FYP's layout: the brand centred in the header, a "Live services"
// badge, "Our Services" with its count, and one photo card per service. A
// launcher's job is to launch, so the card is the button — Food opens the
// Food app, Health and Shopping open what is coming. The shell wears
// MetroMatrix emerald; each card wears its own service's colour.
// Stateless: opening a service records it in preferences.lastService.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { setLastService } from '@store/preferencesSlice';
import { useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Avatar, IconButton } from '@custom/index';
import { ServiceCard, type ServiceCardData } from '@components/home/ServiceCard';
import { SERVICE_CARDS } from '@components/home/serviceCatalog';
import type { HomeStackParamList } from '@/types';
import { selectUser } from '../../Auth/authSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'CustomerHome'>;

const makeStyles = ({ colors, space, gutter, radius, size }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingBottom: space.s40 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: gutter,
      paddingTop: space.s12,
      paddingBottom: space.s8,
    },
    side: { width: size.touch, alignItems: 'center' },
    brand: { alignItems: 'center' },
    live: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      marginHorizontal: gutter,
      marginTop: space.s16,
      marginBottom: space.s20,
      paddingHorizontal: space.s12,
      paddingVertical: space.s8,
      borderRadius: radius.pill,
    },
    liveDot: { width: space.s8, height: space.s8, borderRadius: radius.pill, backgroundColor: colors.danger },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: gutter,
      marginBottom: space.s16,
    },
    count: {
      paddingHorizontal: space.s12,
      paddingVertical: space.s8,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSunk,
    },
    cards: { paddingHorizontal: gutter, gap: space.s16 },
  });

const CustomerHomeScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { service } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAppSelector(selectUser);
  const liveCount = SERVICE_CARDS.filter(c => c.live).length;

  const open = (card: ServiceCardData) => {
    dispatch(setLastService(card.service));
    if (card.service === 'food') navigation.navigate('FoodHome');
    else navigation.navigate('ServicePreview', { service: card.service });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.side}>
            <Pressable
              onPress={() => navigation.getParent()?.navigate('ProfileTab')}
              accessibilityRole="button"
              accessibilityLabel="Your profile"
              hitSlop={6}>
              <Avatar name={user?.name ?? ''} uri={user?.avatarUrl} size="sm" />
            </Pressable>
          </View>
          <View style={styles.brand} accessibilityRole="header">
            <AppText variant="logo" tone="brand">
              MetroMatrix
            </AppText>
            <AppText variant="body" tone="muted">
              Smart City Services
            </AppText>
          </View>
          <View style={styles.side}>
            <IconButton
              icon="bell"
              accessibilityLabel="Notifications"
              onPress={() => Toast.show({ type: 'info', text1: "You're all caught up", text2: 'No new notifications.' })}
            />
          </View>
        </View>

        <View style={[styles.live, { backgroundColor: service.accentSoft }]} accessible accessibilityLabel={`${liveCount} live service`}>
          <View style={styles.liveDot} />
          <AppText variant="micro" tone="accentDeep">
            LIVE SERVICES
          </AppText>
        </View>

        <View style={styles.sectionHead}>
          <View>
            <AppText variant="h1" accessibilityRole="header">
              Our Services
            </AppText>
            <AppText variant="body" tone="muted">
              {user?.name ? `Hi ${user.name.split(' ')[0]}, choose what you need` : 'Choose what you need'}
            </AppText>
          </View>
          <View style={styles.count}>
            <AppText variant="small" tone="muted">
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
