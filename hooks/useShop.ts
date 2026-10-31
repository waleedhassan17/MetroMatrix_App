// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping hooks shared by the customer's screens
// ═══════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from './useReduxHooks';
import { loadBagAsync, selectBagCount } from '../screens/Shopping/Customer/Bag/bagSlice';
import { loadSavedIdsAsync, selectSavedIds, setSavedAsync } from '../screens/Shopping/Customer/Saved/savedSlice';
import type { Banner, ShopBrowseParamList } from '../types';
import { haptics } from '../utils/haptics';

/** The Bag and the hearts load once, on the first Shopping screen. */
export const useShopBootstrap = () => {
  const dispatch = useAppDispatch();
  const bag = useAppSelector(s => s.bag.status);
  const saved = useAppSelector(s => s.saved.status);
  useEffect(() => {
    if (bag === 'idle') void dispatch(loadBagAsync());
    if (saved === 'idle') void dispatch(loadSavedIdsAsync());
  }, [bag, saved, dispatch]);
};

export const useBagCount = () => useAppSelector(selectBagCount);

/** Filled hearts, and a toggle that flips at once (and back if it fails). */
export const useSaved = () => {
  const dispatch = useAppDispatch();
  const ids = useAppSelector(selectSavedIds);
  const set = useMemo(() => new Set(ids), [ids]);
  const toggle = useCallback(
    async (productId: string) => {
      const save = !set.has(productId);
      haptics.press();
      const r = await dispatch(setSavedAsync({ productId, save }));
      if (setSavedAsync.rejected.match(r)) {
        Toast.show({ type: 'error', text1: save ? "Couldn't save it" : "Couldn't remove it", text2: 'Check your connection and try again.' });
      } else if (save) {
        Toast.show({ type: 'success', text1: 'Saved', text2: 'Find it in the Saved tab.' });
      }
    },
    [dispatch, set],
  );
  return { isSaved: (id: string) => set.has(id), toggle };
};

type ShopNav = NativeStackNavigationProp<ShopBrowseParamList>;

/**
 * Where a Shopping tap goes. The browse screens exist in the Home, Orders
 * and Profile stacks, so these push in the stack you are in; the Home-only
 * screens (search, all categories) are reached through the Home tab.
 */
export const useShopNav = () => {
  const navigation = useNavigation<ShopNav>();
  return useMemo(
    () => ({
      navigation,
      openProduct: (id: string, name?: string) => navigation.push('ProductDetail', { id, name }),
      openStore: (slug: string, name?: string) => navigation.navigate('StorePage', { slug, name }),
      openList: (params: ShopBrowseParamList['ProductList']) => navigation.push('ProductList', params),
      openBag: () => navigation.navigate('Bag'),
      /** Search opens over the Shopping tabs; from a store's page it searches that store. */
      openSearch: (scope?: { storeId: string; storeName: string }) =>
        (navigation as unknown as { navigate: (name: string, p?: object) => void }).navigate('ShopSearch', scope),
      openBanner: (b: Banner) => {
        const t = b.target;
        if (t.kind === 'store') navigation.navigate('StorePage', { slug: t.slug });
        else if (t.kind === 'product') navigation.push('ProductDetail', { id: t.id });
        else navigation.push('ProductList', { title: t.name || b.headline, categoryId: t.id });
      },
    }),
    [navigation],
  );
};
