// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen assistant: combo ideas
// ═══════════════════════════════════════════════════════
// Dishes people order together, as one deal at a bundle price: how often
// they were ordered together in 30 days, the price of both apart, and what
// you keep at the price you type (once both have recipe cards). "Create
// the deal" adds it to the menu as a deal at that price; nothing is added
// before that.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { aiDownNote, isAiDown } from '@models/kitchen/aiModel';
import { comboTitle, repriced, savingLine, validateDraftPrice } from '@models/kitchen/assistantModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Button, Card, CostBreakdown, EmptyState, InlineNotice, ScreenShell, SkeletonLines, StatusPill, TextAction, TextField } from '@custom/index';
import type { FoodVendorStackParamList } from '@/types';
import { parseRupees } from '@utils/money';
import { haptics } from '@utils/haptics';
import { createComboAsync, selectAiCombos, setComboPrice, suggestCombosAsync } from './aiCombosSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenAiCombos'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.s12 },
    grow: { flex: 1, minWidth: 0, gap: space.s4 },
  });

const AiCombosScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <AiCombosContent {...props} />
  </ServiceScope>
);

const AiCombosContent: React.FC<Props> = ({ navigation }) => {
  const { back } = useBack({ name: 'KitchenAssistant' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAiCombos);

  const suggest = () => void dispatch(suggestCombosAsync());
  const down = isAiDown(s.error.code) ? aiDownNote(s.error.code, s.error.details) : null;

  const create = async (id: string) => {
    const idea = s.ideas.find(i => i.id === id);
    const price = parseRupees(s.prices[id] ?? '');
    if (!idea || !s.category || price === null) return;
    haptics.press();
    const r = await dispatch(createComboAsync({ idea, categoryId: s.category.id, price }));
    if (createComboAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Deal added', text2: `${comboTitle(idea)} is on your menu under ${s.category.name}.` });
    } else haptics.warning();
  };

  return (
    <ScreenShell title="Combo ideas" subtitle="Dishes people order together" onBack={back} refreshing={s.status === 'loading' && !!s.ideas.length} onRefresh={suggest}>
      {down ? <InlineNotice tone="info" title={down.title} message={`${down.message} You can add a deal in your menu.`} action={{ label: 'Open your menu', onPress: () => navigation.navigate('VendorMenuItem') }} /> : null}
      {s.error.message && !down ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: suggest }} /> : null}
      {s.createError.message ? <InlineNotice message={s.createError.message} /> : null}

      {!s.ideas.length && s.status !== 'loading' && s.status !== 'succeeded' ? (
        <Card>
          <View style={styles.gap}>
            <AppText variant="title">Sell two together</AppText>
            <AppText variant="body">The assistant finds dishes your customers often order together and suggests a price for both, a little less than apart.</AppText>
            <Button label="Find combo ideas" onPress={suggest} fullWidth />
            <AppText variant="caption" tone="muted">
              One assistant action.
            </AppText>
          </View>
        </Card>
      ) : null}
      {s.status === 'loading' && !s.ideas.length ? <SkeletonLines lines={8} /> : null}
      {s.status === 'succeeded' && !s.ideas.length ? <EmptyState icon="shopping-bag" title="No pairs yet" body="Once customers order a main with a side or a drink, ideas show here." /> : null}

      {s.ideas.map(idea => {
        const priceError = validateDraftPrice(s.prices[idea.id] ?? '');
        const price = parseRupees(s.prices[idea.id] ?? '') ?? idea.bundlePrice;
        const cost = idea.cost ? (repriced(idea.cost, s.prices[idea.id] ?? '', s.targetPct) ?? idea.cost) : null;
        const done = s.created[idea.id];
        return (
          <Card key={idea.id}>
            <View style={styles.gap}>
              <View style={styles.head}>
                <View style={styles.grow}>
                  <AppText variant="title">{comboTitle(idea)}</AppText>
                  <AppText variant="small" tone="muted">
                    {`Ordered together ${idea.orderedTogether} ${idea.orderedTogether === 1 ? 'time' : 'times'} in 30 days`}
                  </AppText>
                </View>
                {done ? <StatusPill label="On your menu" tone="success" /> : <StatusPill label="Idea" tone="neutral" />}
              </View>
              <TextField label="Price for both" mode="numeric" value={s.prices[idea.id] ?? ''} onChangeText={v => dispatch(setComboPrice({ id: idea.id, value: v }))} error={priceError ?? undefined} helper={savingLine(idea, price)} />
              {cost ? (
                <CostBreakdown cost={cost} targetPct={s.targetPct} compact />
              ) : (
                <AppText variant="small" tone="muted">
                  Add recipe cards for both dishes to see what you keep.
                </AppText>
              )}
              {done ? (
                <TextAction label="Open the deal" icon="open-outline" onPress={() => navigation.navigate('VendorMenuItem', { id: done })} />
              ) : (
                <Button label={`Create the deal${s.category ? ` in ${s.category.name}` : ''}`} disabled={!!priceError || !s.category} loading={s.creating === idea.id} onPress={() => void create(idea.id)} fullWidth />
              )}
            </View>
          </Card>
        );
      })}
      {s.ideas.length ? (
        <AppText variant="caption" tone="muted">
          Ideas from the assistant. A deal goes on your menu at the price you set; customers pay you directly.
        </AppText>
      ) : null}
    </ScreenShell>
  );
};

export default AiCombosScreen;
