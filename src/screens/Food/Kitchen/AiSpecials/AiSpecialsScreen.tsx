// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen assistant: today's specials
// ═══════════════════════════════════════════════════════
// Ideas for what to cook from the stock that expires soonest (or the
// ingredients an insight card named): what each uses, a suggested price,
// and what it costs to make and what you keep at the price you type.
// "Create as draft dish" adds it to the menu hidden, with its recipe card,
// for the cook to turn on when it's ready. Nothing is added before that.

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { aiDownNote, isAiDown } from '@models/kitchen/aiModel';
import { repriced, validateDraftPrice } from '@models/kitchen/assistantModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, BottomSheetPicker, Button, Card, CostBreakdown, EmptyState, InlineNotice, PickerField, ScreenShell, SkeletonLines, StatusPill, TextAction, TextField } from '@custom/index';
import type { FoodVendorStackParamList } from '@/types';
import { formatPKR, parseRupees } from '@utils/money';
import { haptics } from '@utils/haptics';
import { createSpecialAsync, pickSpecialCategory, selectAiSpecials, setSpecialPrice, suggestSpecialsAsync } from './aiSpecialsSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'KitchenAiSpecials'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    tight: { gap: space.s4 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.s12 },
    grow: { flex: 1, minWidth: 0, gap: space.s4 },
  });

const AiSpecialsScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <AiSpecialsContent {...props} />
  </ServiceScope>
);

const AiSpecialsContent: React.FC<Props> = ({ navigation, route }) => {
  const { back } = useBack({ name: 'KitchenAssistant' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAiSpecials);
  const ingredientIds = route.params?.ingredientIds;
  const [picking, setPicking] = useState<string | null>(null);
  const asked = useRef(false);

  const suggest = () => void dispatch(suggestSpecialsAsync(ingredientIds));
  // From an insight card: its ingredients, once.
  useEffect(() => {
    if (ingredientIds?.length && !asked.current) {
      asked.current = true;
      void dispatch(suggestSpecialsAsync(ingredientIds));
    }
  }, [dispatch, ingredientIds]);

  const down = isAiDown(s.error.code) ? aiDownNote(s.error.code, s.error.details) : null;
  const categoryOf = (id: string) => s.picked[id] ?? s.category?.id ?? s.categories[0]?.id ?? null;
  const categoryName = (id: string | null) => s.categories.find(c => c.id === id)?.name ?? s.category?.name ?? 'your menu';

  const create = async (id: string) => {
    const idea = s.ideas.find(i => i.id === id);
    const categoryId = categoryOf(id);
    const price = parseRupees(s.prices[id] ?? '');
    if (!idea || !categoryId || price === null) return;
    haptics.press();
    const r = await dispatch(createSpecialAsync({ idea, categoryId, price }));
    if (createSpecialAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: `${idea.title} added`, text2: `In ${categoryName(categoryId)}, hidden until you turn it on.` });
    } else haptics.warning();
  };

  return (
    <ScreenShell title="Today’s specials" subtitle="From what expires soonest" onBack={back} refreshing={s.status === 'loading' && !!s.ideas.length} onRefresh={suggest}>
      {down ? (
        <InlineNotice tone="info" title={down.title} message={`${down.message} Add a dish in your menu, or put what expires in a Bachat Box.`} action={{ label: 'Make a Bachat Box', onPress: () => navigation.navigate('KitchenBoxForm', { suggest: true }) }} />
      ) : null}
      {s.error.message && !down ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: suggest }} /> : null}
      {s.createError.message ? <InlineNotice message={s.createError.message} /> : null}

      {!s.ideas.length && s.status !== 'loading' ? (
        <Card>
          <View style={styles.gap}>
            <AppText variant="title">Use it before it goes to waste</AppText>
            <AppText variant="body">The assistant looks at what expires in the next two days and suggests dishes that use it, priced for your food-cost target.</AppText>
            <Button label="Suggest specials" onPress={suggest} fullWidth />
            <AppText variant="caption" tone="muted">
              One assistant action.
            </AppText>
          </View>
        </Card>
      ) : null}
      {s.status === 'loading' && !s.ideas.length ? <SkeletonLines lines={8} /> : null}
      {s.status === 'succeeded' && !s.ideas.length ? <EmptyState icon="check-circle" title="Nothing about to expire" body="No stock runs out of date in the next two days." /> : null}

      {s.ideas.map(idea => {
        const priceError = validateDraftPrice(s.prices[idea.id] ?? '');
        const cost = repriced(idea.cost, s.prices[idea.id] ?? '', s.targetPct) ?? idea.cost;
        const done = s.created[idea.id];
        const categoryId = categoryOf(idea.id);
        return (
          <Card key={idea.id}>
            <View style={styles.gap}>
              <View style={styles.head}>
                <View style={styles.grow}>
                  <AppText variant="title">{idea.title}</AppText>
                  <AppText variant="small" tone="muted">
                    {idea.description}
                  </AppText>
                </View>
                {done ? <StatusPill label="On your menu, hidden" tone="success" /> : <StatusPill label="Idea" tone="neutral" />}
              </View>
              <View style={styles.tight}>
                <AppText variant="small">{`Uses ${idea.uses.join(', ').toLowerCase()}`}</AppText>
                <AppText variant="small" tone="accentDeep">{`Uses up ${idea.usesExpiring.join(', ').toLowerCase()} before it expires`}</AppText>
              </View>
              <TextField label="Price" mode="numeric" value={s.prices[idea.id] ?? ''} onChangeText={v => dispatch(setSpecialPrice({ id: idea.id, value: v }))} error={priceError ?? undefined} helper={`Suggested ${formatPKR(idea.suggestedPrice)}`} />
              <CostBreakdown cost={cost} targetPct={s.targetPct} compact />
              <PickerField label="Goes in" valueLabel={categoryName(categoryId)} placeholder="Pick a category" onPress={() => setPicking(idea.id)} />
              {done ? (
                <TextAction label="Open the new dish" icon="open-outline" onPress={() => navigation.navigate('VendorMenuItem', { id: done })} />
              ) : (
                <Button label="Create as draft dish" disabled={!!priceError || !categoryId} loading={s.creating === idea.id} onPress={() => void create(idea.id)} fullWidth />
              )}
            </View>
          </Card>
        );
      })}
      {s.ideas.length ? (
        <AppText variant="caption" tone="muted">
          Ideas from the assistant. A draft dish is hidden from customers until you turn it on in your menu; its recipe card is saved with it.
        </AppText>
      ) : null}

      <BottomSheetPicker
        visible={!!picking}
        onClose={() => setPicking(null)}
        title="Which category"
        options={s.categories.filter(c => c.isActive).map(c => ({ value: c.id, label: c.name }))}
        value={picking ? categoryOf(picking) : null}
        onSelect={v => {
          if (picking) dispatch(pickSpecialCategory({ id: picking, categoryId: v }));
          setPicking(null);
        }}
      />
    </ScreenShell>
  );
};

export default AiSpecialsScreen;
