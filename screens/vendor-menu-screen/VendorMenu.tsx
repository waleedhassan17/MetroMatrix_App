// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: Menu (the tab)
// ═══════════════════════════════════════════════════════
// Every category with its dishes. A dish's switch takes it off the menu
// right now, for an hour or two, until tomorrow, or until switched back;
// tapping a dish opens it. Categories and the add-on library are a tap away.

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { OFF_CHOICES, categoryWindowLabel, daysLabel, itemPriceLabel, offUntil, type OffFor } from '../../models/food/menuModel';
import { menuStockNote } from '../../models/kitchen/boardModel';
import { ServiceScope, useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, ChoiceChip, Divider, EmptyState, InlineNotice, ListRow, ScreenShell, Sheet } from '../../Custom-Components/index';
import { MenuSkeleton } from '../../Custom-Components/food/FoodSkeletons';
import { QuickActionGrid } from '../../Components/admin/AdminParts';
import { SearchField, ShopSection } from '../../Components/shopping/ShopParts';
import { DishRow } from '../../Custom-Components/food/DishRow';
import type { VendorMenuItem } from '../../models';
import { PKT, addDays, formatSlot, todayInZone, zonedToIso } from '../../utils/health-time/healthTime';
import { haptics } from '../../utils/haptics/haptics';
import { closeOffSheet, loadVendorMenuAsync, openOffSheet, selectVendorMenu, setDishAvailableAsync } from './vendorMenuSlice';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    section: { gap: space.s8 },
    chips: { flexDirection: 'row', gap: space.s8 },
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

/** `onBack`: shown when the menu is a page (a home kitchen opens it from More), not a tab. */
const VendorMenu: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorMenu);
  // Finding a dish: by name, or only what's switched off now (both stay on this screen).
  const [query, setQuery] = useState('');
  const [onlyOff, setOnlyOff] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadVendorMenuAsync());
    }, [dispatch]),
  );

  const offItem = s.items.find(i => i.id === s.offItemId) ?? null;
  const offCount = s.items.filter(i => s.availability[i.id] && !s.availability[i.id].isAvailable).length;
  const loading = s.status === 'loading' && !s.items.length && !s.categories.length;
  const q = query.trim().toLowerCase();
  const shown = (i: VendorMenuItem) => (!q || i.name.toLowerCase().includes(q)) && (!onlyOff || (s.availability[i.id] ? !s.availability[i.id].isAvailable : false));
  const filtering = !!q || onlyOff;

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
        onBack={onBack}
        subtitle={s.items.length ? `${s.items.length} dishes${offCount ? ` · ${offCount} off now` : ''}` : 'What customers can order'}
        refreshing={s.status === 'loading' && !!s.items.length}
        onRefresh={() => void dispatch(loadVendorMenuAsync())}
        footer={
          s.categories.length ? (
            <Button label="Add a dish" leftIcon="add" onPress={() => navigation.navigate('VendorMenuItem', {})} fullWidth />
          ) : undefined
        }
        headerContent={
          s.items.length ? (
            <>
              <SearchField value={query} onChange={setQuery} placeholder="Find a dish" />
              <View style={styles.chips}>
                <ChoiceChip label="All" count={s.items.length} selected={!onlyOff} onPress={() => setOnlyOff(false)} />
                <ChoiceChip label="Off now" count={offCount} selected={onlyOff} onPress={() => setOnlyOff(true)} />
              </View>
            </>
          ) : undefined
        }
      >
        {s.error.message ? <InlineNotice message={s.error.message} action={s.status === 'failed' ? { label: 'Try again', onPress: () => void dispatch(loadVendorMenuAsync()) } : undefined} /> : null}
        {filtering ? null : (
          <QuickActionGrid
            actions={[
              { key: 'cats', icon: 'albums-outline', tint: 'violet', label: 'Categories', onPress: () => navigation.navigate('VendorCategories') },
              { key: 'addons', icon: 'layers-outline', tint: 'blue', label: 'Add-on groups', onPress: () => navigation.navigate('VendorOptionGroups') },
              { key: 'deals', icon: 'pricetag-outline', tint: 'amber', label: 'Deals', onPress: () => navigation.navigate('VendorPromotions') },
            ]}
          />
        )}

        {loading ? (
          <MenuSkeleton />
        ) : !s.categories.length && s.status !== 'failed' ? (
          <EmptyState
            ion="book-outline"
            title="Start your menu"
            body="Add a category first, like Biryani or Drinks, then the dishes in it."
            action={{ label: 'Add a category', onPress: () => navigation.navigate('VendorCategories') }}
          />
        ) : (
          s.categories.map(c => {
            const all = s.items.filter(i => i.categoryId === c.id);
            const dishes = all.filter(shown);
            if (filtering && !dishes.length) return null;
            return (
              <View key={c.id} style={styles.section}>
                <ShopSection
                  title={c.name}
                  subtitle={[`${all.length} ${all.length === 1 ? 'dish' : 'dishes'}`, c.isActive ? null : 'Hidden', c.availableFrom ? `Served ${categoryWindowLabel(c.availableFrom, c.availableTo)}` : null].filter(Boolean).join(' · ')}
                  inset={false}
                />
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
                            detail={[menuStockNote(i.id, s.stock), detailOf(i)].filter(Boolean).join(' · ')}
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
                  ) : filtering ? null : (
                    <ListRow title="No dishes yet" subtitle="Add the first one" leftIcon="add-circle-outline" onPress={() => navigation.navigate('VendorMenuItem', { categoryId: c.id })} />
                  )}
                </Card>
              </View>
            );
          })
        )}
        {filtering && !s.items.some(shown) ? <EmptyState ion="search-outline" title="No dish matches" body={onlyOff ? 'Every dish is on right now.' : 'Try another name.'} /> : null}

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

export default VendorMenu;
