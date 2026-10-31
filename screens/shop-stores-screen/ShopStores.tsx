// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: stores (featured on the home)
// ═══════════════════════════════════════════════════════

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { useDebouncedValue, usePagedList } from '../../hooks/usePagedList';
import { getAdminStoresAPI } from '../../networks/admin/adminShopNetwork';
import { useStyles, type Theme } from '../../theme/index';
import { Card, EmptyState, InlineNotice, ScreenShell, SkeletonLines, StoreMark, ToggleRow } from '../../Custom-Components/index';
import { SearchField } from '../../Components/shopping/ShopParts';
import type { AdminShopStackParamList } from '../../models';
import { selectShopStores, setFeaturedAsync, setStoresQuery } from './shopStoresSlice';
import { storeSummaryPageSerializer } from '../../serializers/shopping/catalogSerializer';

type Props = NativeStackScreenProps<AdminShopStackParamList, 'ShopStores'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1 },
    list: { gap: space.s12, paddingTop: space.s4, paddingBottom: space.s40 },
  });

const ShopStores: React.FC<Props> = () => {
  const { back } = useBack({ name: 'ShopOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectShopStores);
  const q = useDebouncedValue(s.query.trim());
  const list = usePagedList((page, sz) => getAdminStoresAPI(q, page, sz), storeSummaryPageSerializer, `admin-stores|${q}`);

  const toggle = async (id: string, featured: boolean) => {
    const r = await dispatch(setFeaturedAsync({ id, featured }));
    if (setFeaturedAsync.fulfilled.match(r)) list.setRows(rows => rows.map(x => (x.id === id ? r.payload : x)));
  };

  return (
    <ScreenShell
      title="Stores"
      subtitle={list.isLoading ? 'Featured stores lead the Shopping home' : `${list.total} stores · featured ones lead the Shopping home`}
      onBack={back}
      scroll={false}
      headerContent={<SearchField value={s.query} onChange={t => dispatch(setStoresQuery(t))} placeholder="Store or city" />}>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      <FlatList
        data={list.rows}
        keyExtractor={st => st.id}
        contentContainerStyle={styles.list}
        onEndReached={list.loadMore}
        renderItem={({ item: st }) => (
          <Card>
            <View style={styles.row}>
              <StoreMark store={st} small />
              <View style={styles.grow}>
                <ToggleRow label={st.name} helper={`${st.city} · ${st.productCount} products${st.isPaused ? ' · paused' : ''}`} value={st.isFeatured} onChange={v => void toggle(st.id, v)} disabled={s.busy === st.id} />
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          list.isLoading ? <SkeletonLines lines={5} /> : list.error ? <InlineNotice message={list.error} /> : <EmptyState icon="shopping-bag" title="No stores match" body="Try another name or city." />
        }
      />
    </ScreenShell>
  );
};

export default ShopStores;
