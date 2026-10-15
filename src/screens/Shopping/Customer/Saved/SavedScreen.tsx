// ═══════════════════════════════════════════════════════
// MetroMatrix — Saved products (Profile → Saved, and the side menu)
// ═══════════════════════════════════════════════════════
// Everything you hearted, newest first, refreshed whenever you come back.
// Un-hearting takes it off the list at once.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePagedList } from '@hooks/usePagedList';
import { useShopBootstrap } from '@hooks/useShop';
import { listWishlist } from '@networks/shopping/wishlistNetwork';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { ProductGrid, ShopTopBar } from '@components/shopping/ShopParts';
import type { AccountStackParamList } from '@/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'Saved'>;

const makeStyles = ({ colors }: Theme) => StyleSheet.create({ root: { flex: 1, backgroundColor: colors.canvas } });

const SavedScreen: React.FC<Props> = props => (
  <ServiceScope service="shopping">
    <SavedContent {...props} />
  </ServiceScope>
);

const SavedContent: React.FC<Props> = ({ navigation }) => {
  const styles = useStyles(makeStyles);
  const root = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const list = usePagedList((page, size) => listWishlist(page, size), 'saved');
  useShopBootstrap();

  return (
    <View style={styles.root}>
      <ShopTopBar title="Saved" onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
      <ProductGrid
        list={list}
        onRemoveFromSaved={id => list.setRows(rows => rows.filter(r => r.id !== id))}
        empty={{
          icon: 'heart',
          title: 'Nothing saved yet',
          body: 'Tap the heart on anything you like, and it waits for you here.',
          action: { label: 'Start shopping', onPress: () => root.navigate('HomeTab', { screen: 'ShoppingHome' }) },
        }}
      />
    </View>
  );
};

export default SavedScreen;
