// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: stores (featured on the home)
// ═══════════════════════════════════════════════════════

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { useDebouncedValue, usePagedList } from '@hooks/usePagedList';
import { listAdminStores } from '@networks/admin/adminShopNetwork';
import { useStyles, type Theme } from '@theme/index';
import { AppText, Divider, EmptyState, InlineNotice, ScreenShell, SkeletonLines, StoreMark, TextField, ToggleRow } from '@custom/index';
import type { AdminShopStackParamList } from '@/types';
import { selectShopStores, setFeaturedAsync, setStoresQuery } from './shopStoresSlice';

type Props = NativeStackScreenProps<AdminShopStackParamList, 'ShopStores'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s8 },
    grow: { flex: 1 },
    list: { paddingBottom: space.s40 },
  });

const ShopStoresScreen: React.FC<Props> = () => {
  const { back } = useBack({ name: 'ShopOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectShopStores);
  const q = useDebouncedValue(s.query.trim());
  const list = usePagedList((page, sz) => listAdminStores(q, page, sz), `admin-stores|${q}`);

  const toggle = async (id: string, featured: boolean) => {
    const r = await dispatch(setFeaturedAsync({ id, featured }));
    if (setFeaturedAsync.fulfilled.match(r)) list.setRows(rows => rows.map(x => (x.id === id ? r.payload : x)));
  };

  return (
    <ScreenShell title="Stores" subtitle="Featured stores lead the Shopping home." onBack={back} scroll={false}>
      <TextField label="Search" value={s.query} onChangeText={t => dispatch(setStoresQuery(t))} icon="search" placeholder="Store or city" clearable />
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      <FlatList
        data={list.rows}
        keyExtractor={st => st.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        onEndReached={list.loadMore}
        renderItem={({ item: st }) => (
          <View style={styles.row}>
            <StoreMark store={st} small />
            <View style={styles.grow}>
              <ToggleRow label={st.name} helper={`${st.city} · ${st.productCount} products${st.isPaused ? ' · paused' : ''}`} value={st.isFeatured} onChange={v => void toggle(st.id, v)} disabled={s.busy === st.id} />
            </View>
          </View>
        )}
        ListEmptyComponent={
          list.isLoading ? <SkeletonLines lines={5} /> : list.error ? <InlineNotice message={list.error} /> : <EmptyState icon="shopping-bag" title="No stores match" body="Try another name or city." />
        }
        ListHeaderComponent={
          <AppText variant="caption" tone="muted">
            {list.total} stores
          </AppText>
        }
      />
    </ScreenShell>
  );
};

export default ShopStoresScreen;
