// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court's bag, wherever the customer is
// ═══════════════════════════════════════════════════════
// The bag loads once on the first Food screen and then follows the
// customer: the header's bag icon and the floating "View your bag" dock
// (FoodBagDock) read it here, on Home, the lists, search, saved kitchens,
// the Orders tab and a kitchen's page.

import { useCallback, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from './useReduxHooks';
import { loadFoodBagAsync, selectFoodBag } from '../screens/food-bag-screen/foodBagSlice';

type Nav = { navigate: (name: string, params?: object) => void };

export const useFoodBag = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<Nav>();
  const bag = useAppSelector(selectFoodBag);
  useEffect(() => {
    if (bag.status === 'idle') void dispatch(loadFoodBagAsync());
  }, [bag.status, dispatch]);
  const openBag = useCallback(() => navigation.navigate('FoodBag'), [navigation]);
  return {
    count: bag.cart.empty ? 0 : bag.cart.itemCount,
    subtotal: bag.cart.subtotal,
    vendor: bag.cart.vendor,
    busy: bag.adding,
    openBag,
  };
};
