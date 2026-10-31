// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping search
// ═══════════════════════════════════════════════════════
// The keyboard comes up at once. Before you type: your recent searches (hold
// one to remove it) and the categories. As you type (after a short pause):
// matching categories, stores and products, typos forgiven. Opened from a
// store's page, it searches that store until you remove the store chip.

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { useDebouncedValue } from '../../../../hooks/usePagedList';
import { useShopNav } from '../../../../hooks/useShop';
import { MAX_FONT_SCALE, ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, CategoryTile, ChoiceChip, Divider, IconButton, IonIcon, type IonName } from '../../../../Custom-Components/index';
import { addRecentSearch, clearRecentSearches, removeRecentSearch, selectRecentSearches } from '../../../../store/preferencesSlice';
import type { HomeStackParamList, SearchSuggestion } from '../../../../types';
import { loadCategoriesAsync, selectCategoryBrowse } from '../CategoryBrowse/categoryBrowseSlice';
import { SUGGEST_MIN, selectShopSearch, setSearchQuery, suggestAsync } from './shopSearchSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'ShopSearch'>;

const KIND_ICON: Record<SearchSuggestion['kind'], IonName> = {
  product: 'search',
  store: 'storefront-outline',
  category: 'grid-outline',
};

const makeStyles = ({ colors, space, size, radius, gutter, type }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    bar: { flexDirection: 'row', alignItems: 'center', gap: space.s4, paddingHorizontal: space.s8, paddingBottom: space.s8 },
    field: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s8,
      height: size.control.md,
      paddingHorizontal: space.s16,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSunk,
    },
    input: { flex: 1, ...type.input, color: colors.ink, paddingVertical: space.s0, outlineWidth: 0, outlineStyle: 'solid' },
    scope: { paddingHorizontal: gutter, paddingBottom: space.s8, flexDirection: 'row' },
    content: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s24 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: size.control.md },
    rowText: { flex: 1 },
    group: { gap: space.s8 },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s12 },
  });

const ShopSearchScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <ShopSearchContent {...props} />
  </ServiceScope>
);

const ShopSearchContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'ShoppingHome' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, motion, opacity } = useTheme();
  const insets = useSafeAreaInsets();
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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <IconButton icon="chevron-back" onPress={back} accessibilityLabel="Back" />
        <View style={styles.field}>
          <IonIcon name="search" size="md" color={colors.inkMuted} />
          <TextInput
            value={s.query}
            onChangeText={t => dispatch(setSearchQuery(t))}
            onSubmitEditing={() => search(s.query)}
            placeholder={scope ? `Search ${scope.name}` : 'Search products, stores and brands'}
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            autoFocus
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Search the shops"
          />
          {s.query ? (
            <Pressable onPress={() => dispatch(setSearchQuery(''))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
              <IonIcon name="close-circle" size="md" color={colors.inkFaint} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {scope ? (
        <View style={styles.scope}>
          <ChoiceChip label={`In ${scope.name}`} icon="close" selected accessibilityHint="Search every store instead" onPress={() => setScope(null)} />
        </View>
      ) : null}

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
                <View style={styles.head}>
                  <AppText variant="title">Recent searches</AppText>
                  <Pressable onPress={() => dispatch(clearRecentSearches())} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear recent searches">
                    <AppText variant="small" tone="accentDeep">
                      Clear all
                    </AppText>
                  </Pressable>
                </View>
                {recent.map(r => (
                  <View key={r} style={styles.row}>
                    <Pressable
                      onPress={() => search(r)}
                      onLongPress={() => dispatch(removeRecentSearch(r))}
                      style={({ pressed }) => [styles.row, styles.rowText, pressed && { opacity: opacity.pressed }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Search again: ${r}`}
                      accessibilityHint="Hold to remove it">
                      <IonIcon name="time-outline" size="md" color={colors.inkMuted} />
                      <AppText variant="body" style={styles.rowText} numberOfLines={1}>
                        {r}
                      </AppText>
                    </Pressable>
                    <IconButton icon="close" tone="muted" onPress={() => dispatch(removeRecentSearch(r))} accessibilityLabel={`Remove ${r}`} />
                  </View>
                ))}
              </View>
            ) : null}
            {categories.categories.length ? (
              <View style={styles.group}>
                <View style={styles.head}>
                  <AppText variant="title">Browse categories</AppText>
                  <Pressable onPress={() => navigation.navigate('CategoryBrowse')} hitSlop={8} accessibilityRole="link" accessibilityLabel="See all categories">
                    <AppText variant="small" tone="accentDeep">
                      See all
                    </AppText>
                  </Pressable>
                </View>
                <View style={styles.tiles}>
                  {categories.categories.flatMap(c => [c, ...c.children]).slice(0, 8).map(c => (
                    <CategoryTile key={c.id} name={c.name} icon={c.icon} onPress={() => openList({ title: c.name, categoryId: c.id })} />
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

export default ShopSearchScreen;
