// ═══════════════════════════════════════════════════════
// MetroMatrix — All categories
// ═══════════════════════════════════════════════════════
// Two panes, as shopping apps do it: the top levels down the side, the
// chosen one's sub-categories (with how many products each has) beside it.

import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useShopNav } from '@hooks/useShop';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Divider, IonIcon, ListRow, SkeletonLines, categoryIcon } from '@custom/index';
import { SectionError, ShopTopBar } from '@components/shopping/ShopParts';
import type { HomeStackParamList } from '@/types';
import {
  loadCategoriesAsync,
  selectCategoryBrowse,
  selectTopCategory,
  topLevelOf,
} from './categoryBrowseSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'CategoryBrowse'>;

const makeStyles = ({ colors, space, size, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    panes: { flex: 1, flexDirection: 'row' },
    side: { width: size.categoryWell * 2, backgroundColor: colors.surfaceSunk },
    top: {
      alignItems: 'center',
      gap: space.s4,
      paddingVertical: space.s16,
      paddingHorizontal: space.s8,
      borderLeftWidth: size.focusBorder,
      borderLeftColor: colors.surfaceSunk,
    },
    main: { flex: 1 },
    mainContent: { paddingHorizontal: gutter, paddingBottom: space.s40, paddingTop: space.s8 },
    loading: { padding: gutter },
  });

const CategoryBrowseScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <CategoryBrowseContent {...props} />
  </ServiceScope>
);

const CategoryBrowseContent: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const s = useAppSelector(selectCategoryBrowse);
  const { openList } = useShopNav();
  const asked = route.params?.categoryId;

  useEffect(() => {
    if (s.status === 'idle' || s.status === 'failed') void dispatch(loadCategoriesAsync());
    // Only on arrival: a retry is the button's job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  // Arriving from a home tile opens that category.
  useEffect(() => {
    const top = topLevelOf(s.categories, asked);
    if (top) dispatch(selectTopCategory(top));
  }, [asked, s.categories, dispatch]);

  const selected = s.categories.find(c => c.id === s.selectedId) ?? null;

  return (
    <View style={styles.root}>
      <ShopTopBar title="Categories" onBack={() => navigation.goBack()} />
      <Divider />
      {s.status === 'failed' && !s.categories.length ? (
        <SectionError
          message={s.error.message}
          onRetry={() => void dispatch(loadCategoriesAsync())}
        />
      ) : !s.categories.length ? (
        <View style={styles.loading}>
          <SkeletonLines lines={6} />
        </View>
      ) : (
        <View style={styles.panes}>
          <View style={styles.side}>
            <ScrollView accessibilityRole="tablist">
              {s.categories.map(c => {
                const on = c.id === s.selectedId;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => dispatch(selectTopCategory(c.id))}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={c.name}
                    style={[
                      styles.top,
                      on && { backgroundColor: colors.canvas, borderLeftColor: service.accent },
                    ]}>
                    <IonIcon
                      name={categoryIcon(c.icon)}
                      size="lg"
                      color={on ? service.accent : colors.inkMuted}
                    />
                    <AppText
                      variant={on ? 'chip' : 'caption'}
                      tone={on ? 'accentDeep' : 'muted'}
                      align="center"
                      numberOfLines={2}>
                      {c.name}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <View style={styles.main}>
            <ScrollView contentContainerStyle={styles.mainContent}>
              {selected ? (
                <>
                  <ListRow
                    title={`All ${selected.name}`}
                    value={String(selected.productCount)}
                    leftIcon={categoryIcon(selected.icon)}
                    onPress={() => openList({ title: selected.name, categoryId: selected.id })}
                  />
                  {selected.children.map(child => (
                    <View key={child.id}>
                      <Divider />
                      <ListRow
                        title={child.name}
                        value={String(child.productCount)}
                        leftIcon={categoryIcon(child.icon)}
                        onPress={() => openList({ title: child.name, categoryId: child.id })}
                      />
                    </View>
                  ))}
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
};

export default CategoryBrowseScreen;
