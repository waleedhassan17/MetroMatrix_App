// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: Menu (the tab)
// ═══════════════════════════════════════════════════════
// Every category with its dishes. A dish's switch takes it off the menu
// right now, for an hour or two, until tomorrow, or until switched back;
// tapping a dish opens it. Categories and the add-on library are a tap away.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { OFF_CHOICES, categoryWindowLabel, daysLabel, itemPriceLabel, offUntil, type OffFor } from '@models/food/menuModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Button, Card, Divider, EmptyState, InlineNotice, ListRow, ScreenShell, Sheet, SkeletonLines, TextAction } from '@custom/index';
import { DishRow } from '@custom/food/DishRow';
import type { VendorMenuItem } from '@/types';
import { PKT, addDays, formatSlot, todayInZone, zonedToIso } from '@utils/healthTime';
import { haptics } from '@utils/haptics';
import { closeOffSheet, loadVendorMenuAsync, openOffSheet, selectVendorMenu, setDishAvailableAsync } from './vendorMenuSlice';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s16 },
    section: { gap: space.s8 },
    sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.s8 },
  });

/** "3 sizes · Thu–Sat · Hidden". */
const detailOf = (i: VendorMenuItem) =>
  [
    i.variants.length ? `${i.variants.length} sizes` : null,
    i.days.length < 7 ? daysLabel(i.days) : null,
    i.isDeal ? 'Deal' : null,
    i.isActive ? null : 'Hidden from customers',
  ]
    .filter(Boolean)
    .join(' · ');

/** When an "off for" choice ends, from now (tomorrow starts at midnight in Pakistan). */
const untilFromNow = (choice: OffFor) => offUntil(choice, Date.now(), zonedToIso(addDays(todayInZone(PKT), 1), '00:00', PKT));

const VendorMenuScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorMenu);

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadVendorMenuAsync());
    }, [dispatch]),
  );

  const offItem = s.items.find(i => i.id === s.offItemId) ?? null;
  const offCount = s.items.filter(i => s.availability[i.id] && !s.availability[i.id].isAvailable).length;
  const loading = s.status === 'loading' && !s.items.length && !s.categories.length;

  const toggle = (item: VendorMenuItem, next: boolean) => {
    haptics.select();
    if (next) void dispatch(setDishAvailableAsync({ itemId: item.id, isAvailable: true, until: null }));
    else dispatch(openOffSheet(item.id));
  };

  const switchOff = (choice: OffFor) => {
    if (!offItem) return;
    void dispatch(setDishAvailableAsync({ itemId: offItem.id, isAvailable: false, until: untilFromNow(choice) }));
  };

  return (
    <ServiceScope service="food">
      <ScreenShell
        title="Menu"
        subtitle={s.items.length ? `${s.items.length} dishes${offCount ? ` · ${offCount} off now` : ''}` : 'What customers can order'}
        refreshing={s.status === 'loading' && !!s.items.length}
        onRefresh={() => void dispatch(loadVendorMenuAsync())}
        footer={
          s.categories.length ? (
            <Button label="Add a dish" leftIcon="add" onPress={() => navigation.navigate('VendorMenuItem', {})} fullWidth />
          ) : undefined
        }
      >
        {s.error.message ? <InlineNotice message={s.error.message} action={s.status === 'failed' ? { label: 'Try again', onPress: () => void dispatch(loadVendorMenuAsync()) } : undefined} /> : null}
        <View style={styles.links}>
          <TextAction label="Categories" icon="albums-outline" onPress={() => navigation.navigate('VendorCategories')} />
          <TextAction label="Add-on groups" icon="options-outline" onPress={() => navigation.navigate('VendorOptionGroups')} />
        </View>

        {loading ? (
          <SkeletonLines lines={10} />
        ) : !s.categories.length && s.status !== 'failed' ? (
          <EmptyState
            icon="book-open"
            title="Start your menu"
            body="Add a category first, like Biryani or Drinks, then the dishes in it."
            action={{ label: 'Add a category', onPress: () => navigation.navigate('VendorCategories') }}
          />
        ) : (
          s.categories.map(c => {
            const dishes = s.items.filter(i => i.categoryId === c.id);
            return (
              <View key={c.id} style={styles.section}>
                <View style={styles.sectionHead}>
                  <AppText variant="sectionTitle" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {c.name}
                  </AppText>
                  <AppText variant="small" tone="muted">
                    {[c.isActive ? null : 'Hidden', c.availableFrom ? categoryWindowLabel(c.availableFrom, c.availableTo) : null].filter(Boolean).join(' · ')}
                  </AppText>
                </View>
                <Card padded="horizontal">
                  {dishes.length ? (
                    dishes.map((i, n) => {
                      const a = s.availability[i.id];
                      const available = a ? a.isAvailable : true;
                      return (
                        <View key={i.id}>
                          {n > 0 ? <Divider /> : null}
                          <DishRow
                            name={i.name}
                            price={itemPriceLabel(i)}
                            photoUrl={i.photoUrl}
                            detail={detailOf(i)}
                            available={available}
                            hidden={!i.isActive}
                            offLabel={!available ? (a?.unavailableUntil ? `Off until ${formatSlot(a.unavailableUntil, PKT)}` : 'Off until you switch it on') : null}
                            saving={s.saving.includes(i.id)}
                            onPress={() => navigation.navigate('VendorMenuItem', { id: i.id })}
                            onToggle={next => toggle(i, next)}
                          />
                        </View>
                      );
                    })
                  ) : (
                    <ListRow title="No dishes yet" subtitle="Add the first one" leftIcon="add-circle-outline" onPress={() => navigation.navigate('VendorMenuItem', { categoryId: c.id })} />
                  )}
                </Card>
              </View>
            );
          })
        )}

        <Sheet visible={!!offItem} onClose={() => dispatch(closeOffSheet())} title={offItem ? `Switch off ${offItem.name}` : ''}>
          <AppText variant="small" tone="muted">
            Customers see it as unavailable and can’t add it to their order.
          </AppText>
          <Card padded="horizontal">
            {OFF_CHOICES.map((c, n) => (
              <View key={c.key}>
                {n > 0 ? <Divider /> : null}
                <ListRow title={c.label} leftIcon={c.key === 'manual' ? 'pause-circle-outline' : 'time-outline'} onPress={() => switchOff(c.key)} chevron={false} />
              </View>
            ))}
          </Card>
        </Sheet>
      </ScreenShell>
    </ServiceScope>
  );
};

export default VendorMenuScreen;
