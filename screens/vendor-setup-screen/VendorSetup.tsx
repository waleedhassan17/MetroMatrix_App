// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor setup
// ═══════════════════════════════════════════════════════
// Until customers can order: the brand, the address and pin, opening hours,
// delivery fee bands and a way to be paid — and for home kitchens,
// MetroMatrix's food-safety check after a test order. Each row opens its
// editor; Go live is enabled once every row is done.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, Card, Divider, IonIcon, InlineNotice, ListRow, ProgressBar, ScreenShell, TextAction, Skeleton, RowCardsSkeleton, StatusPill, type IonName } from '../../Custom-Components/index';
import { TrustNote } from '../../Components/food/FoodParts';
import { VENDOR_TRUST_LINE } from '../../models/food/trustModel';
import type { FoodVendorStackParamList } from '../../models';
import { KITCHEN_KIND_NAME, setupRoute, setupTitle } from '../../models/food/vendorModel';
import { haptics } from '../../utils/haptics/haptics';
import { selectBusiness } from '../../store/authSlice';
import { goLiveAsync, loadVendorSetupAsync, selectVendorSetup } from './vendorSetupSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorSetup'>;

const HINT: Record<string, string> = {
  profile: 'Name, logo and at least one cuisine',
  location: 'Where riders collect and customers pick up',
  hours: 'When customers can order',
  zones: 'How far you deliver, and what it costs',
  payment: 'Cash, pay at pickup, or a transfer account',
  food_safety: 'MetroMatrix places a test order and checks the food',
  menu: 'At least one dish customers can order',
  portions: 'How many plates of each dish you cook today',
  slots: 'When customers can collect or receive a pre-order',
};

/** Each step's glyph while it's still to do. */
const SETUP_ICON: Record<string, IonName> = {
  profile: 'color-palette-outline',
  location: 'location-outline',
  hours: 'time-outline',
  zones: 'navigate-circle-outline',
  payment: 'card-outline',
  food_safety: 'shield-checkmark-outline',
  menu: 'book-outline',
  portions: 'restaurant-outline',
  slots: 'alarm-outline',
};

const makeStyles = ({ space, size, radius }: Theme) =>
  StyleSheet.create({
    progress: { gap: space.s8 },
    progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    well: { width: size.subTypeTile, height: size.subTypeTile, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    loading: { gap: space.s16 },
  });

const VendorSetup: React.FC<Props> = props => (
  <ServiceScope service="food">
    <VendorSetupContent {...props} />
  </ServiceScope>
);

const VendorSetupContent: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, service, size } = useTheme();
  const s = useAppSelector(selectVendorSetup);
  const setup = s.setup;
  const business = useAppSelector(selectBusiness);
  // A kitchen that isn't live yet lives here (no way round it); once live, back goes to More.
  const live = !!business?.food?.isLive || !!setup?.isLive;
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'MoreTab' } });
  const canGoBack = live || navigation.canGoBack();

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadVendorSetupAsync());
    }, [dispatch]),
  );

  const toTabs = () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'VendorTabs' }] }));

  const goLive = async () => {
    const r = await dispatch(goLiveAsync());
    if (goLiveAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'You are live', text2: 'Customers can find you and order now.' });
      toTabs();
    } else haptics.warning();
  };

  const done = setup ? setup.items.filter(i => i.done).length : 0;
  return (
    <ScreenShell
      title="Kitchen setup"
      subtitle={live ? 'You are live on Food Court' : 'Finish these so customers can order'}
      onBack={canGoBack ? back : undefined}
      headerRight={!canGoBack ? <TextAction label="Account" icon="person-circle-outline" onPress={() => navigation.navigate('Profile')} /> : undefined}
      footer={
        setup && !live ? (
          <Button
            label={setup.ready ? 'Go live' : `Go live (${setup.percent}% done)`}
            onPress={() => void goLive()}
            disabled={!setup.ready}
            loading={s.goingLive}
            fullWidth
          />
        ) : undefined
      }
      refreshing={s.status === 'loading' && !!setup}
      onRefresh={() => void dispatch(loadVendorSetupAsync())}
    >
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadVendorSetupAsync()) }} /> : null}
      {!setup ? (
        s.status === 'failed' ? null : (
          <View style={styles.loading} accessibilityLabel="Loading" accessibilityRole="progressbar">
            <Skeleton height={size.control.lg} shape="lg" />
            <RowCardsSkeleton count={4} />
          </View>
        )
      ) : (
        <>
          <Card>
            <View style={styles.progress}>
              <View style={styles.progressHead}>
                <AppText variant="title" accessibilityRole="header">
                  {setup.ready ? 'All done' : `${done} of ${setup.items.length} done`}
                </AppText>
                <AppText variant="bodyStrong" tone="accentDeep">{`${setup.percent}%`}</AppText>
              </View>
              <ProgressBar progress={setup.percent / 100} thickness="step" accessibilityLabel={`Kitchen setup ${setup.percent}% done`} />
            </View>
          </Card>
          <Card padded="horizontal">
            {setup.items.map((item, i) => {
              const to = setupRoute(item.key, business?.subType === 'home_kitchen');
              return (
                <View key={item.key}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    title={setupTitle(item.key, item.label)}
                    subtitle={item.key === 'food_safety' && !item.done ? 'MetroMatrix will contact you to arrange a test order' : HINT[item.key]}
                    left={
                      <View style={[styles.well, { backgroundColor: item.done ? colors.successSoft : service.accentSoft }]}>
                        <IonIcon name={item.done ? 'checkmark' : SETUP_ICON[item.key] ?? 'ellipse-outline'} size="md" color={item.done ? colors.success : service.accentDeep} />
                      </View>
                    }
                    right={item.done ? <StatusPill label="Done" tone="success" /> : undefined}
                    onPress={to ? () => (navigation.navigate as (name: string, params?: object) => void)(to.name, to.params) : undefined}
                    // Done rows can still be opened to change them, without asking for attention.
                    chevron={!!to && !item.done}
                  />
                </View>
              );
            })}
          </Card>
          {live ? <Button label="Go to orders" variant="secondary" onPress={toTabs} fullWidth /> : <TrustNote text={`${KITCHEN_KIND_NAME[setup.kind]} on Food Court. ${VENDOR_TRUST_LINE}`} />}
        </>
      )}
    </ScreenShell>
  );
};

export default VendorSetup;
