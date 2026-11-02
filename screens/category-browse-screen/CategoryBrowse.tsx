// ═══════════════════════════════════════════════════════
// MetroMatrix — All categories
// ═══════════════════════════════════════════════════════
// Two panes, as shopping apps do it: the top levels down a white side rail
// (the chosen one on a soft accent pill), the chosen one's sub-categories
// (with how many products each has) in one card beside it.

import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useShopNav } from '../../hooks/useShop';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Card, Divider, IonIcon, ListRow, Skeleton, categoryIcon } from '../../Custom-Components/index';
import { SectionError, ShopSection, ShopTopBar } from '../../Components/shopping/ShopParts';
import type { HomeStackParamList } from '../../models';
import {
  loadCategoriesAsync,
  selectCategoryBrowse,
  selectTopCategory,
  topLevelOf,
} from './categoryBrowseSlice';

type Props = NativeStackScreenProps<HomeStackParamList, 'CategoryBrowse'>;

const makeStyles = ({ colors, space, size, radius, gutter }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    panes: { flex: 1, flexDirection: 'row', paddingTop: space.s16 },
    side: { width: size.categoryWell * 2, borderRightWidth: size.hairline, borderRightColor: colors.line },
    sideContent: { paddingHorizontal: space.s8, paddingBottom: space.s40, gap: space.s4 },
    top: {
      alignItems: 'center',
      gap: space.s4,
      paddingVertical: space.s12,
      paddingHorizontal: space.s8,
      borderRadius: radius.md,
    },
    main: { flex: 1 },
    mainContent: { paddingHorizontal: gutter, paddingBottom: space.s40, gap: space.s12 },
    loading: { padding: gutter, gap: space.s12 },
  });

const CategoryBrowse: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <CategoryBrowseContent {...props} />
  </ServiceScope>
);

const CategoryBrowseContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'ShoppingHome' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, service, size } = useTheme();
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
      <ShopTopBar title="Categories" subtitle="Everything the stores sell" onBack={back} />
      {s.status === 'failed' && !s.categories.length ? (
        <SectionError
          message={s.error.message}
          onRetry={() => void dispatch(loadCategoriesAsync())}
        />
      ) : !s.categories.length ? (
        <View style={styles.loading} accessibilityLabel="Loading" accessibilityRole="progressbar">
          {[0, 1, 2, 3, 4].map(i => (
            <Skeleton key={i} height={size.control.md} shape="md" />
          ))}
        </View>
      ) : (
        <View style={styles.panes}>
          <View style={styles.side}>
            <ScrollView accessibilityRole="tablist" contentContainerStyle={styles.sideContent}>
              {s.categories.map(c => {
                const on = c.id === s.selectedId;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => dispatch(selectTopCategory(c.id))}
                    accessibilityRole="tab"
                    aria-selected={on}
                    accessibilityLabel={c.name}
                    style={[styles.top, on && { backgroundColor: service.accentSoft }]}>
                    <IonIcon
                      name={categoryIcon(c.icon)}
                      size="lg"
                      color={on ? service.accentDeep : colors.inkMuted}
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
                  <ShopSection
                    title={selected.name}
                    subtitle={`${selected.productCount} ${selected.productCount === 1 ? 'product' : 'products'}`}
                    inset={false}
                  />
                  <Card padded="horizontal">
                    <ListRow
                      title={`All ${selected.name}`}
                      value={String(selected.productCount)}
                      onPress={() => openList({ title: selected.name, categoryId: selected.id })}
                    />
                    {selected.children.map(child => (
                      <View key={child.id}>
                        <Divider />
                        <ListRow
                          title={child.name}
                          value={String(child.productCount)}
                          onPress={() => openList({ title: child.name, categoryId: child.id })}
                        />
                      </View>
                    ))}
                  </Card>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
};

export default CategoryBrowse;
