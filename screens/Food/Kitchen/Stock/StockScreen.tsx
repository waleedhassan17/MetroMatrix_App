// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen: stock
// ═══════════════════════════════════════════════════════
// Every ingredient against the level it is restocked at, grouped by kind:
// all of them, what's running low, what expires soon, what's below zero.
// Speak a purchase, waste or a count ("5 kilo tamatar 1200 rupay"); count
// stock, add a purchase, or add an ingredient by hand.

import React, { useCallback, useEffect } from 'react';
import { ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { useDebouncedValue } from '../../../../hooks/usePagedList';
import { CATEGORY_LABEL, CATEGORY_ORDER, STOCK_SEGMENTS } from '../../../../models/kitchen/kitchenStatusModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, Button, ChoiceChip, EmptyState, InlineNotice, ScreenShell, SkeletonLines, StockLevelBar } from '../../../../Custom-Components/index';
import { SearchField } from '../../../../Components/shopping/ShopParts';
import { VoiceSheetButton } from '../../../../Components/voice/VoiceSheet';
import type { FoodVendorStackParamList, Ingredient, VoiceAction } from '../../../../types';
import { haptics } from '../../../../utils/haptics';
import { todayInZone } from '../../../../utils/healthTime';
import { confirmStockVoiceAsync, loadStockAsync, selectStock, setStockQuery, setStockSegment } from './stockSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenStock'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s12, paddingBottom: space.s40 },
    head: { paddingTop: space.s16, paddingBottom: space.s4 },
    item: { paddingBottom: space.s12 },
    actions: { flexDirection: 'row', gap: space.s8 },
    chipBar: { flexGrow: 0, flexShrink: 0 },
    chips: { gap: space.s8 },
    grow: { flex: 1 },
  });

const StockScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <StockContent {...props} />
  </ServiceScope>
);

const StockContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'VendorTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectStock);
  const q = useDebouncedValue(s.q.trim());
  const today = todayInZone('Asia/Karachi');

  useEffect(() => {
    if (route.params?.segment) dispatch(setStockSegment(route.params.segment));
  }, [dispatch, route.params?.segment]);

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadStockAsync({ segment: s.segment, q }));
    }, [dispatch, s.segment, q]),
  );

  const sections = CATEGORY_ORDER.map(cat => ({ title: CATEGORY_LABEL[cat], data: (s.list?.items ?? []).filter(i => i.category === cat) })).filter(x => x.data.length);
  const counts = s.list?.counts;

  const confirm = async (action: VoiceAction) => {
    const res = await dispatch(confirmStockVoiceAsync(action));
    if (confirmStockVoiceAsync.fulfilled.match(res)) {
      haptics.success();
      Toast.show({ type: 'success', text1: res.payload });
      void dispatch(loadStockAsync({ segment: s.segment, q }));
      return true;
    }
    haptics.warning();
    return false;
  };

  return (
    <ScreenShell
      title="Stock"
      subtitle={counts ? `${counts.all} ingredients${counts.low ? ` · ${counts.low} running low` : ''}` : 'What you have, and what to buy'}
      onBack={back}
      scroll={false}
      headerRight={
        <VoiceSheetButton
          context="stock"
          title="Speak a purchase, waste or a count"
          onConfirm={confirm}
          onEdit={a => (a.kind === 'purchase.add' ? navigation.navigate('KitchenPurchaseForm', { draft: a.lines }) : undefined)}
          busy={s.confirming}
        />
      }
      headerContent={
        <>
          <SearchField value={s.q} onChange={t => dispatch(setStockQuery(t))} placeholder="Search: tomato, tamatar, ٹماٹر" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
            {STOCK_SEGMENTS.map(x => (
              <ChoiceChip
                key={x.key}
                label={counts && x.key !== 'all' && counts[x.key] ? `${x.label} · ${counts[x.key]}` : x.label}
                selected={s.segment === x.key}
                onPress={() => dispatch(setStockSegment(x.key))}
              />
            ))}
          </ScrollView>
        </>
      }
      footer={
        <View style={styles.actions}>
          <View style={styles.grow}>
            <Button label="Count stock" variant="secondary" leftIcon="clipboard-outline" onPress={() => navigation.navigate('KitchenStockTake')} fullWidth />
          </View>
          <View style={styles.grow}>
            <Button label="Add a purchase" leftIcon="add" onPress={() => navigation.navigate('KitchenPurchaseForm')} fullWidth />
          </View>
        </View>
      }>
      {s.confirmError.message ? <InlineNotice message={s.confirmError.message} /> : null}
      <SectionList
        sections={sections}
        keyExtractor={(i: Ingredient) => i.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        onRefresh={() => void dispatch(loadStockAsync({ segment: s.segment, q }))}
        refreshing={s.status === 'loading' && !!s.list}
        renderSectionHeader={({ section }) => (
          <View style={styles.head}>
            <AppText variant="overline" tone="muted" accessibilityRole="header">
              {section.title}
            </AppText>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <StockLevelBar ingredient={item} today={today} onPress={() => navigation.navigate('KitchenIngredient', { id: item.id })} />
          </View>
        )}
        ListEmptyComponent={
          !s.list && s.status !== 'failed' ? (
            <SkeletonLines lines={8} />
          ) : s.status === 'failed' ? (
            <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadStockAsync({ segment: s.segment, q })) }} />
          ) : (
            <EmptyState
              icon="package"
              title={q ? `Nothing called “${q}”` : s.segment === 'all' ? 'No ingredients yet' : 'Nothing here'}
              body={s.segment === 'all' ? 'Add a purchase and its ingredients join your stock.' : 'Good: nothing in this list needs you.'}
              action={s.segment === 'all' ? { label: 'Add an ingredient', onPress: () => navigation.navigate('KitchenIngredientForm', q ? { name: q } : undefined) } : undefined}
            />
          )
        }
        ListFooterComponent={
          s.list?.items.length ? (
            <Button label="Add an ingredient" variant="ghost" leftIcon="add-circle-outline" onPress={() => navigation.navigate('KitchenIngredientForm')} />
          ) : null
        }
      />
    </ScreenShell>
  );
};

export default StockScreen;
