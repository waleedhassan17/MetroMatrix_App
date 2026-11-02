// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping search
// ═══════════════════════════════════════════════════════
// The FYP's search: the gradient header with the field in it, the keyboard up
// at once. Before you type: your recent searches as pills (hold one to remove
// it) and the categories as photo tiles. As you type (after a short pause):
// matching categories, stores and products, typos forgiven. Opened from a
// store's page, it searches that store until you remove the store chip.

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useGridSizing } from '../../hooks/useGridSizing';
import { useDebouncedValue } from '../../hooks/usePagedList';
import { useShopNav } from '../../hooks/useShop';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, CategoryTile, ChoiceChip, Divider, IonIcon, TextAction, type IonName } from '../../Custom-Components/index';
import { SearchField, ShopSection, ShopTopBar } from '../../Components/shopping/ShopParts';
import { CATEGORY_PHOTOS } from '../../Components/shopping/shopPhotos';
import { addRecentSearch, clearRecentSearches, removeRecentSearch, selectRecentSearches } from '../../store/preferencesSlice';
import type { HomeStackParamList, SearchSuggestion } from '../../models';
import { loadCategoriesAsync, selectCategoryBrowse } from '../category-browse-screen/categoryBrowseSlice';
import { SUGGEST_MIN, selectShopSearch, setSearchQuery, suggestAsync } from './shopSearchSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'ShopSearch'>;

const KIND_ICON: Record<SearchSuggestion['kind'], IonName> = {
  product: 'search',
  store: 'storefront-outline',
  category: 'grid-outline',
};

const makeStyles = ({ colors, space, size, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scope: { flexDirection: 'row' },
    content: { paddingHorizontal: gutter, paddingTop: space.s20, paddingBottom: space.s40, gap: space.s24 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: size.control.md },
    rowText: { flex: 1 },
    group: { gap: space.s12 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.s16 },
    cell: { alignItems: 'center' },
  });

/** How many category tiles Search shows before "View all". */
const SEARCH_CATEGORIES = 6;

const ShopSearch: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <ShopSearchContent {...props} />
  </ServiceScope>
);

const ShopSearchContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'ShoppingHome' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, motion, opacity } = useTheme();
  const grid = useGridSizing(3);
  const s = useAppSelector(selectShopSearch);
  const recent = useAppSelector(selectRecentSearches);
  const categories = useAppSelector(selectCategoryBrowse);
  const { openList, openStore } = useShopNav();
  const [scope, setScope] = useState(route.params?.storeId ? { id: route.params.storeId, name: route.params.storeName ?? 'this store' } : null);
  const typed = s.query.trim();
  const settled = useDebouncedValue(typed, motion.suggestDebounce);

  useEffect(() => {
    if (route.params?.q) dispatch(setSearchQuery(route.params.q));
  }, [route.params?.q, dispatch]);

  useEffect(() => {
    if (categories.status === 'idle') void dispatch(loadCategoriesAsync());
  }, [categories.status, dispatch]);

  useEffect(() => {
    if (settled.length >= SUGGEST_MIN) void dispatch(suggestAsync(settled));
  }, [settled, dispatch]);

  const search = (q: string) => {
    const text = q.trim();
    if (!text) return;
    dispatch(addRecentSearch(text));
    openList(scope ? { title: `"${text}" in ${scope.name}`, q: text, storeId: scope.id } : { title: `"${text}"`, q: text });
  };

  const pick = (sug: SearchSuggestion) => {
    if (sug.kind === 'store') openStore(sug.id, sug.label);
    else if (sug.kind === 'category') openList({ title: sug.label, categoryId: sug.id });
    else search(sug.query);
  };

  const showSuggestions = typed.length >= SUGGEST_MIN && s.suggestedFor === settled && settled === typed;

  return (
    <View style={styles.root}>
      <ShopTopBar title="Search" subtitle={scope ? `In ${scope.name}` : 'Products from every brand'} onBack={back}>
        <SearchField
          value={s.query}
          onChange={t => dispatch(setSearchQuery(t))}
          onSubmit={() => search(s.query)}
          placeholder={scope ? `Search ${scope.name}` : 'Search products, stores and brands'}
          autoFocus
        />
        {scope ? (
          <View style={styles.scope}>
            <ChoiceChip label={`In ${scope.name}`} icon="close" selected accessibilityHint="Search every store instead" onPress={() => setScope(null)} />
          </View>
        ) : null}
      </ShopTopBar>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {showSuggestions ? (
          <View>
            {s.suggestions.length ? (
              s.suggestions.map((sug, i) => (
                <View key={`${sug.kind}-${sug.id}`}>
                  {i > 0 ? <Divider /> : null}
                  <Pressable
                    onPress={() => pick(sug)}
                    style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${sug.label}, ${sug.kind}`}>
                    <IonIcon name={KIND_ICON[sug.kind]} size="md" color={colors.inkMuted} />
                    <View style={styles.rowText}>
                      <AppText variant="body" numberOfLines={1}>
                        {sug.label}
                      </AppText>
                      {sug.kind !== 'product' ? (
                        <AppText variant="caption" tone="muted">
                          {sug.kind === 'store' ? 'Store' : 'Category'}
                        </AppText>
                      ) : null}
                    </View>
                    <IonIcon name="arrow-forward" size="sm" color={colors.inkFaint} />
                  </Pressable>
                </View>
              ))
            ) : (
              <Pressable onPress={() => search(typed)} style={styles.row} accessibilityRole="button">
                <IonIcon name="search" size="md" color={colors.inkMuted} />
                <AppText variant="body">Search for “{typed}”</AppText>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            {recent.length ? (
              <View style={styles.group}>
                <ShopSection
                  title="Recent searches"
                  inset={false}
                  trailing={
                    <TextAction label="Clear all" onPress={() => dispatch(clearRecentSearches())} accessibilityLabel="Clear recent searches" />
                  }
                />
                <View style={styles.pills}>
                  {recent.map(r => (
                    <ChoiceChip
                      key={r}
                      label={r}
                      icon="time-outline"
                      onPress={() => search(r)}
                      onLongPress={() => dispatch(removeRecentSearch(r))}
                      accessibilityHint="Searches again. Hold to remove it"
                    />
                  ))}
                </View>
              </View>
            ) : null}
            {categories.categories.length ? (
              <View style={styles.group}>
                <ShopSection title="Browse categories" inset={false} onSeeAll={() => navigation.navigate('CategoryBrowse')} />
                <View style={styles.tiles} onLayout={grid.onLayout}>
                  {categories.categories.slice(0, SEARCH_CATEGORIES).map((c, i) => (
                    <View key={c.id} style={[styles.cell, { width: grid.cellWidth, marginLeft: i % 3 ? grid.gap : 0 }]}>
                      <CategoryTile
                        variant="photo"
                        name={c.name}
                        icon={c.icon}
                        photo={CATEGORY_PHOTOS[c.slug] ?? null}
                        onPress={() => openList({ title: c.name, categoryId: c.id })}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default ShopSearch;
