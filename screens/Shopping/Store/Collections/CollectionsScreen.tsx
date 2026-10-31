// ═══════════════════════════════════════════════════════
// MetroMatrix — Collections (the store's own shelves)
// ═══════════════════════════════════════════════════════
// The chips customers see on the store page, in this order. Rename, move up
// and down, add; a collection with products in it can't be deleted until
// they move elsewhere.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, Divider, EmptyState, IconButton, InlineNotice, ScreenShell, Sheet, SkeletonLines, TextAction, TextField } from '../../../../Custom-Components/index';
import type { Collection, StorePartnerStackParamList } from '../../../../types';
import { Alert } from '../../../../utils/alert';
import {
  changeCollectionsAsync,
  closeCollectionSheet,
  loadCollectionsAsync,
  openCollectionSheet,
  selectCollections,
  setCollectionName,
} from './collectionsSlice';

type Props = NativeStackScreenProps<StorePartnerStackParamList, 'Collections'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s4, paddingVertical: space.s8 },
    text: { flex: 1, gap: space.s4 },
    actions: { flexDirection: 'row', gap: space.s16 },
  });

const CollectionsScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <CollectionsContent {...props} />
  </ServiceScope>
);

const CollectionsContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'StoreTabs', params: { screen: 'MoreTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectCollections);
  const list = s.collections;

  useEffect(() => {
    void dispatch(loadCollectionsAsync());
  }, [dispatch]);

  const move = (i: number, by: -1 | 1) => {
    const ids = list.map(c => c.id);
    const to = i + by;
    [ids[i], ids[to]] = [ids[to], ids[i]];
    void dispatch(changeCollectionsAsync({ kind: 'reorder', ids }));
  };

  const remove = (c: Collection) =>
    Alert.alert(`Delete "${c.name}"?`, c.productCount ? 'It still has products. Move them first.' : 'Customers won’t see this shelf any more.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void dispatch(changeCollectionsAsync({ kind: 'delete', id: c.id })) },
    ]);

  return (
    <ScreenShell
      title="Collections"
      subtitle="The shelves on your store page, in this order."
      onBack={back}
      footer={<Button label="New collection" leftIcon="add" onPress={() => dispatch(openCollectionSheet(null))} fullWidth />}>
      {s.error.message && s.editing === null ? <InlineNotice message={s.error.message} /> : null}
      {s.status === 'loading' && !list.length ? (
        <SkeletonLines lines={5} />
      ) : !list.length ? (
        <EmptyState icon="folder" title="No collections yet" body="Group products the way you'd arrange a shop window: new arrivals, Eid edit, basics." />
      ) : (
        <Card>
          {list.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <View style={styles.text}>
                  <AppText variant="bodyStrong">{c.name}</AppText>
                  <AppText variant="caption" tone="muted">
                    {c.productCount} {c.productCount === 1 ? 'product' : 'products'}
                  </AppText>
                  <View style={styles.actions}>
                    <TextAction label="Rename" onPress={() => dispatch(openCollectionSheet({ id: c.id, name: c.name }))} />
                    <TextAction label="Delete" tone="danger" onPress={() => remove(c)} />
                  </View>
                </View>
                <IconButton icon="arrow-up" tone="muted" disabled={i === 0 || !!s.busy} onPress={() => move(i, -1)} accessibilityLabel={`Move ${c.name} up`} />
                <IconButton icon="arrow-down" tone="muted" disabled={i === list.length - 1 || !!s.busy} onPress={() => move(i, 1)} accessibilityLabel={`Move ${c.name} down`} />
              </View>
            </View>
          ))}
        </Card>
      )}

      <Sheet
        visible={s.editing !== null}
        onClose={() => dispatch(closeCollectionSheet())}
        title={s.editing ? 'Rename collection' : 'New collection'}
        footer={
          <Button
            label="Save"
            disabled={s.name.trim().length < 2}
            loading={s.busy === 'save'}
            onPress={() => void dispatch(changeCollectionsAsync({ kind: 'save', id: s.editing ?? '', name: s.name }))}
            fullWidth
          />
        }>
        <TextField label="Name" value={s.name} onChangeText={t => dispatch(setCollectionName(t))} placeholder="Eid edit" autoFocus />
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default CollectionsScreen;
