// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor (home kitchen): Today
// ═══════════════════════════════════════════════════════
// The day's dishes: cooking or not, and how many plates. Dishes not on
// today's menu are listed below, with the weekly menu a tap away. The
// kitchen's forecast offers today's portions in one tap; "aaj 20 biryani"
// sets them by voice; in the evening, leftovers go up as a Bachat Box. The
// day at a glance on stat tiles (new orders, dishes cooking, plates left)
// and the kitchen's daily tools as quick tiles, under its own mark.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { DAY_LONG } from '../../models/food/menuModel';
import { portionsLine } from '../../models/kitchen/forecastModel';
import { VoiceSheetButton } from '../../Components/voice/VoiceSheet';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { Button, Card, CountIconButton, Divider, EmptyState, InlineNotice, RowCardsSkeleton, ScreenShell, StatGridSkeleton, StoreMark, TextAction, ToggleRow, AppText } from '../../Custom-Components/index';
import { QuickActionGrid, RowCard, StatGrid } from '../../Components/admin/AdminParts';
import { ShopSection } from '../../Components/shopping/ShopParts';
import { selectNewOrderCount, selectVendorBoard } from '../vendor-orders-screen/vendorBoardSlice';
import { selectUnreadCount } from '../notifications-screen/notificationsSlice';
import { PortionStepper } from '../../Custom-Components/food/PortionStepper';
import { formatDayFull, hourOfDay } from '../../utils/health-time/healthTime';
import { useNow } from '../../hooks/useNow';
import Toast from 'react-native-toast-message';
import { haptics } from '../../utils/haptics/haptics';
import { selectBusiness } from '../../store/authSlice';
import { applyPortions, discardToday, editToday, loadTodayAsync, saveTodayAsync, selectSuggestedPortions, selectVendorToday } from './vendorTodaySlice';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ space, size, radius, colors }: Theme) =>
  StyleSheet.create({
    dish: { gap: space.s4, paddingVertical: space.s12 },
    gap: { gap: space.s8 },
    footer: { gap: space.s4, alignItems: 'center' },
    mark: { borderRadius: radius.pill, borderWidth: size.focusBorder, borderColor: colors.onScrimLine },
  });

const VendorToday: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorToday);
  const business = useAppSelector(selectBusiness);
  const suggested = useAppSelector(selectSuggestedPortions);
  const profile = useAppSelector(selectVendorBoard).profile;
  const newOrders = useAppSelector(selectNewOrderCount);
  const unread = useAppSelector(selectUnreadCount);
  const { service } = useTheme();
  const t = s.today;
  const now = useNow(60_000);
  /** From 5 PM: leftovers can go up as a Bachat Box for tonight. */
  const evening = hourOfDay(new Date(now).toISOString(), 'Asia/Karachi') >= 17;

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadTodayAsync());
    }, [dispatch]),
  );

  const dirty = Object.keys(s.edits).length > 0;
  const onMenu = t?.items.filter(i => i.onTodaysMenu) ?? [];
  const offMenu = t?.items.filter(i => !i.onTodaysMenu) ?? [];
  const cookingNow = onMenu.filter(i => i.cooking);
  const platesLeft = cookingNow.reduce((n, i) => (i.dailyLimit === null ? n : n + Math.max(0, i.dailyLimit - (i.sold ?? 0))), 0);
  const limited = cookingNow.some(i => i.dailyLimit !== null);
  const tiffinsTomorrow = s.tiffin?.plans.reduce((n, p) => n + p.count, 0) ?? 0;
  const name = profile?.name ?? business?.name ?? 'Today';

  const save = async () => {
    const r = await dispatch(saveTodayAsync());
    if (saveTodayAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Today saved' });
    } else haptics.warning();
  };

  return (
    <ServiceScope service="food">
      <ScreenShell
        title="Today"
        subtitle={t ? `${DAY_LONG[t.weekday]}, ${formatDayFull(t.date)}` : business?.name}
        refreshing={s.status === 'loading' && !!t}
        onRefresh={() => void dispatch(loadTodayAsync())}
        headerLeading={
          <View style={styles.mark}>
            <StoreMark store={{ name, logoUrl: profile?.logoUrl ?? null, brandColor: profile?.brandColor ?? service.accent }} size="md" />
          </View>
        }
        headerRight={
          <>
          <VoiceSheetButton
            context="today"
            title="Speak today’s portions"
            busy={s.saving}
            onConfirm={async a => {
              if (a.kind !== 'portions.set') return false;
              dispatch(applyPortions(a.lines.map(l => ({ itemId: l.itemId, portions: l.portions }))));
              const r = await dispatch(saveTodayAsync());
              if (saveTodayAsync.fulfilled.match(r)) {
                haptics.success();
                Toast.show({ type: 'success', text1: 'Today saved', text2: portionsLine(a.lines) });
                return true;
              }
              haptics.warning();
              return false;
            }}
          />
          <CountIconButton icon="notifications-outline" count={unread} onPress={() => navigation.navigate('Notifications')} label="Notifications" />
          </>
        }
        footer={
          dirty ? (
            <View style={styles.footer}>
              <Button label="Save today" onPress={() => void save()} loading={s.saving} fullWidth />
              <TextAction label="Discard changes" tone="muted" onPress={() => dispatch(discardToday())} />
            </View>
          ) : undefined
        }
      >
        {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadTodayAsync()) }} /> : null}
        {t ? (
          <StatGrid
            columns={3}
            compact
            stats={[
              { key: 'new', icon: 'receipt-outline', tint: 'accent', value: newOrders, label: 'New orders', onPress: () => navigation.navigate('VendorTabs', { screen: 'OrdersTab' }) },
              { key: 'cooking', icon: 'flame-outline', tint: 'amber', value: cookingNow.length, label: 'Cooking today' },
              { key: 'plates', icon: 'restaurant-outline', tint: 'green', value: limited ? platesLeft : '—', label: 'Plates left' },
            ]}
          />
        ) : s.status !== 'failed' ? (
          <StatGridSkeleton />
        ) : null}
        <QuickActionGrid
          actions={[
            { key: 'weekly', icon: 'calendar-number-outline', tint: 'amber', label: 'Weekly menu', onPress: () => navigation.navigate('VendorWeeklyMenu') },
            { key: 'slots', icon: 'alarm-outline', tint: 'green', label: 'Pre-order slots', onPress: () => navigation.navigate('VendorPreorderSlots') },
            { key: 'menu', icon: 'book-outline', tint: 'rose', label: 'Menu', onPress: () => navigation.navigate('VendorMenuPage') },
            { key: 'box', icon: 'gift-outline', tint: 'teal', label: 'Bachat Box', onPress: () => navigation.navigate('KitchenBoxForm', { suggest: evening }) },
            { key: 'tiffin', icon: 'calendar-outline', tint: 'violet', label: 'Tiffins', onPress: () => navigation.navigate('GrowthTiffin') },
            { key: 'riders', icon: 'bicycle-outline', tint: 'blue', label: 'Riders', onPress: () => navigation.navigate('VendorRidersPage') },
          ]}
        />
        {suggested.length && !dirty ? (
          <InlineNotice
            tone="info"
            title="Suggested portions for today"
            message={`From your usual orders (estimated): ${portionsLine(suggested)}.`}
            action={{ label: 'Use these', onPress: () => dispatch(applyPortions(suggested)) }}
          />
        ) : null}
        {tiffinsTomorrow ? (
          <RowCard
            title={`Tiffins tomorrow: ${tiffinsTomorrow}`}
            lines={[
              s.tiffin!.plans
                .filter(p => p.count)
                .map(p => `${p.name}: ${p.count} (${p.dishes.join(', ')})`)
                .join(' · '),
            ]}
            mark={{ icon: 'calendar-outline', tint: 'violet' }}
            chevron
            onPress={() => navigation.navigate('GrowthTiffin')}
          />
        ) : null}
        {evening && t?.items.some(i => i.onTodaysMenu && i.cooking) ? (
          <RowCard
            title="Food left tonight?"
            lines={['Put it up as a Bachat Box: sold for pickup at a lower price instead of thrown away.']}
            mark={{ icon: 'gift-outline', tint: 'teal' }}
            chevron
            onPress={() => navigation.navigate('KitchenBoxForm', { suggest: true })}
          />
        ) : null}
        {!t ? (
          s.status === 'failed' ? null : <RowCardsSkeleton count={3} />
        ) : !t.items.length ? (
          <EmptyState ion="book-outline" title="Add your dishes first" body="Put your dishes on the menu, then set how many plates you cook each day." action={{ label: 'Open the menu', onPress: () => navigation.navigate('VendorMenuPage') }} />
        ) : (
          <>
            <ShopSection title="Cooking today" subtitle="Turn a dish off for the day, or set how many plates" inset={false} />
            {onMenu.length ? (
              <Card padded="horizontal">
                {onMenu.map((i, n) => {
                  const e = s.edits[i.itemId] ?? {};
                  const cooking = e.cooking ?? i.cooking;
                  const portions = e.portions !== undefined ? e.portions : i.dailyLimit;
                  return (
                    <View key={i.itemId}>
                      {n > 0 ? <Divider /> : null}
                      <View style={styles.dish}>
                        <ToggleRow label={i.name} helper={cooking ? undefined : 'Off for today'} value={cooking} onChange={v => dispatch(editToday({ itemId: i.itemId, edit: { cooking: v } }))} />
                        {cooking ? <PortionStepper name={i.name} portions={portions} sold={i.sold} onChange={p => dispatch(editToday({ itemId: i.itemId, edit: { portions: p } }))} /> : null}
                      </View>
                    </View>
                  );
                })}
              </Card>
            ) : (
              <AppText variant="small" tone="muted">
                Nothing is on today’s menu. Choose the days for each dish in the weekly menu.
              </AppText>
            )}
            {offMenu.length ? (
              <>
                <ShopSection title="Not on today’s menu" inset={false} />
                <Card padded="horizontal">
                  {offMenu.map((i, n) => (
                    <View key={i.itemId}>
                      {n > 0 ? <Divider /> : null}
                      <View style={styles.dish}>
                        <AppText variant="bodyStrong" tone="muted">
                          {i.name}
                        </AppText>
                      </View>
                    </View>
                  ))}
                </Card>
              </>
            ) : null}
          </>
        )}
      </ScreenShell>
    </ServiceScope>
  );
};

export default VendorToday;
