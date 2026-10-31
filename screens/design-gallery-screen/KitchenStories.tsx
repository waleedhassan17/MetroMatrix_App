// ═══════════════════════════════════════════════════════
// MetroMatrix — Design Gallery: the Kitchen Intelligence components
// ═══════════════════════════════════════════════════════
// Every kitchen component on demo values (local on purpose: nothing here is
// app data), at 100% and 130% text, and laid out at tablet width (two
// columns). Light only, like the app.

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ServiceScope, ThemeScope, getTheme, useStyles, withTextScale, type Theme } from '../../theme/index';
import {
  AppText,
  BadgeRow,
  Button,
  CostBreakdown,
  DemandHeatmap,
  ExpiryChip,
  ForecastBar,
  HourCurve,
  InsightCard,
  NutritionBlock,
  PantryItemRow,
  PrepList,
  QuadrantChart,
  QuoteCard,
  RecipeLineRow,
  RecipeSuggestionCard,
  SegmentTabs,
  StockLevelBar,
  SurplusCard,
  TiffinPlanCard,
  VoiceButton,
  VoiceResultCard,
} from '../../Custom-Components/index';
import type { ForecastItem, Ingredient, InsightCard as InsightCardData, SurplusCard as SurplusCardData, VoiceLanguage, VoiceResult } from '../../models';
import { addDays, todayInZone } from '../../utils/health-time/healthTime';
import { formatQty } from '../../utils/units/units';
import { announce } from '../../services/announcer';

const TODAY = todayInZone('Asia/Karachi');

const CARDS: InsightCardData[] = [
  { id: 'a', kind: 'expiring_stock', severity: 'warning', title: '4 kg chicken expires tomorrow', why: 'Coriander and milk too. Use them before they go to waste.', action: { kind: 'create_surplus', label: 'Make a Bachat Box', params: {} } },
  { id: 'b', kind: 'price_rise', severity: 'info', title: 'Tomato up 32%', why: 'Chicken Karahi now costs Rs 491 to make. You keep 66%.', action: { kind: 'open_recipe', label: 'Check the recipe', params: { itemId: 'x' } } },
  { id: 'c', kind: 'negative_stock', severity: 'critical', title: 'Cream is recorded below zero', why: 'Orders used more than your stock shows. Count it to put the numbers right.', action: { kind: 'stock_take', label: 'Count stock', params: {} } },
];

const ing = (over: Partial<Ingredient>): Ingredient => ({
  id: 'i',
  name: 'Tomato',
  category: 'vegetables',
  baseUnit: 'g',
  dozens: false,
  customUnits: [],
  onHand: 7500,
  parLevel: 10000,
  state: 'low',
  costPerBase: 0.23,
  latestCostPerBase: 0.23,
  expiring: null,
  priceRefKey: 'tomato',
  nutritionFoodId: null,
  updatedAt: '',
  ...over,
});

const STOCK: Ingredient[] = [
  ing({ id: '1', name: 'Chicken (curry cut)', category: 'meat_poultry', onHand: 16000, parLevel: 10000, state: 'ok', expiring: { on: addDays(TODAY, 1), qty: 4000 } }),
  ing({ id: '2', name: 'Yoghurt', category: 'dairy', onHand: 1500, parLevel: 4000, state: 'low', expiring: { on: addDays(TODAY, 2), qty: 1500 } }),
  ing({ id: '3', name: 'Cream', category: 'dairy', onHand: -200, parLevel: 1000, state: 'negative' }),
  ing({ id: '4', name: 'Eggs', baseUnit: 'pc', dozens: true, onHand: 24, parLevel: 36, state: 'low' }),
];

const FORECAST: ForecastItem[] = [
  { itemId: 'a', name: 'Chicken Biryani', photoUrl: null, expected: 42, low: 35, high: 49, learning: false, adjusted: null, fixed: { tiffin: 0, catering: 0 }, planned: 42 },
  { itemId: 'b', name: 'Seekh Kebab (4 pcs)', photoUrl: null, expected: 18, low: 13, high: 24, learning: false, adjusted: 22, fixed: { tiffin: 0, catering: 0 }, planned: 22 },
  { itemId: 'c', name: 'Chicken qorma with 2 roti', photoUrl: null, expected: 11, low: 5, high: 18, learning: true, adjusted: null, fixed: { tiffin: 4, catering: 0 }, planned: 15 },
];

const BOX: SurplusCardData = {
  id: 'b',
  title: 'Chef’s mix box',
  contentsHint: 'Biryani and kebabs from today',
  photoUrl: null,
  value: 1200,
  price: 450,
  left: 2,
  status: 'live',
  pickupFrom: '',
  pickupTo: '',
  pickupLabel: 'Today, 9:00 PM – 11:00 PM',
  vendor: { id: 'v', slug: 'biryani-bazaar', name: 'Biryani Bazaar', logoUrl: null, area: 'Gulberg III', isHomeKitchen: false, distanceKm: 1.2 },
};

const RESULT: VoiceResult = {
  id: 'v',
  transcript: '۵ کلو ٹماٹر ۱۲۰۰ روپے',
  language: 'ur',
  confidence: 0.9,
  action: { kind: 'purchase.add', lines: [{ ingredientId: 'i', key: 'tomato', name: 'Tomato', qty: 5, unit: 'kg', total: 1200 }] },
  alternatives: [],
  heard: 'audio',
};

const UNSURE: VoiceResult = {
  id: 'u',
  transcript: 'accept karo',
  language: 'ur',
  confidence: 0.6,
  action: { kind: 'order.accept', orderId: 'o1', code: 'FC-NBNWXT', etaMinutes: null },
  alternatives: [{ transcript: 'accept karo (FC-7KQ2PX)', action: { kind: 'order.accept', orderId: 'o2', code: 'FC-7KQ2PX', etaMinutes: null } }],
  heard: 'text',
};

const CELLS = Array.from({ length: 12 }, (_, n) => {
  const lat = 31.5 + Math.floor(n / 4) * 0.0055;
  const lng = 74.33 + (n % 4) * 0.011;
  return { id: `c${n}`, sw: { lat, lng }, ne: { lat: lat + 0.0055, lng: lng + 0.011 }, searches: 10 + ((n * 37) % 60), unmetShare: n % 5 === 0 ? 0.62 : 0.2 };
});

const AREA = [2, 1, 1, 0, 0, 0, 1, 3, 5, 6, 8, 14, 26, 30, 22, 14, 12, 16, 24, 34, 38, 32, 20, 9];
const OWN = [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 6, 12, 14, 9, 5, 4, 6, 10, 16, 18, 13, 7, 2];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    section: { gap: space.s12 },
    rail: { gap: space.s12 },
    columns: { flexDirection: 'row', gap: space.s16 },
    column: { flex: 1, gap: space.s12 },
  });

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <AppText variant="micro" tone="muted">
        {title}
      </AppText>
      {children}
    </View>
  );
};

const Stories: React.FC<{ tablet: boolean }> = ({ tablet }) => {
  const styles = useStyles(makeStyles);
  const [language, setLanguage] = useState<VoiceLanguage>('auto');
  const [explained, setExplained] = useState(false);
  const [heard, setHeard] = useState<VoiceResult | null>(null);
  const [clip, setClip] = useState<string | null>(null);
  const [spoken, setSpoken] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [amount, setAmount] = useState('150');

  const cards = CARDS.map(c => <InsightCard key={c.id} card={c} onAction={() => undefined} onDismiss={() => undefined} />);
  const stock = STOCK.map(i => <StockLevelBar key={i.id} ingredient={i} today={TODAY} onPress={() => undefined} />);

  return (
    <>
      <Section title="Kitchen · Insight cards">{tablet ? <View style={styles.columns}><View style={styles.column}>{cards.slice(0, 2)}</View><View style={styles.column}>{cards.slice(2)}</View></View> : cards}</Section>

      <Section title="Kitchen · Voice">
        <VoiceButton
          onClip={c => {
            setClip(`Recorded ${Math.round(c.durationMs / 100) / 10} s · ${c.mimeType}${c.file ? ` · ${Math.round(c.file.size / 1024)} KB` : ''}`);
            setHeard(RESULT);
          }}
          language={language} onLanguageChange={setLanguage} explained={explained} onExplained={() => setExplained(true)} hint="Try “5 kilo tamatar 1200 rupay”" onTypeInstead={() => setHeard(UNSURE)} />
        {clip ? (
          <AppText variant="small" tone="muted" testID="gallery-clip">
            {clip}
          </AppText>
        ) : null}
        <Button
          label="Hear an announcement"
          variant="secondary"
          onPress={() =>
            void announce({ orderId: 'o', text: language === 'ur' ? 'نیا آرڈر، FC-NBNWXT۔ 2 Chicken Biryani۔ ڈیلیوری۔' : 'New order, F C N B N W X T. 2 Chicken Biryani. Delivery.', language: language === 'ur' ? 'ur' : 'en', ttsUrl: null }, 0).then(setSpoken)
          }
        />
        {spoken ? (
          <AppText variant="small" tone="muted" testID="gallery-spoken">
            Announcement: {spoken}
          </AppText>
        ) : null}
        <VoiceResultCard result={heard ?? RESULT} onConfirm={() => setHeard(null)} onEdit={() => undefined} onRetry={() => setHeard(null)} onDiscard={() => setHeard(null)} note="Dummy API: a sample phrase stands in for your recording." />
        <VoiceResultCard result={UNSURE} onConfirm={() => undefined} onRetry={() => undefined} onDiscard={() => undefined} />
      </Section>

      <Section title="Kitchen · Stock">{tablet ? <View style={styles.columns}><View style={styles.column}>{stock.slice(0, 2)}</View><View style={styles.column}>{stock.slice(2)}</View></View> : stock}</Section>

      <Section title="Kitchen · Expiry">
        <View style={styles.columns}>
          <ExpiryChip on={addDays(TODAY, -1)} today={TODAY} />
          <ExpiryChip on={TODAY} today={TODAY} />
          <ExpiryChip on={addDays(TODAY, 1)} today={TODAY} />
          <ExpiryChip on={addDays(TODAY, 3)} today={TODAY} />
        </View>
      </Section>

      <Section title="Kitchen · Recipe card">
        <RecipeLineRow name="Chicken (curry cut)" amount={amount} unitLabel="g" costLabel="Rs 93" onAmountChange={setAmount} onUnitPress={() => undefined} onNamePress={() => undefined} onRemove={() => undefined} />
        <RecipeLineRow name="Biryani box" amount="1" unitLabel="piece" costLabel="Rs 25" onAmountChange={() => undefined} onUnitPress={() => undefined} onNamePress={() => undefined} onRemove={() => undefined} tag="Packaging" />
        <RecipeLineRow name="Yoghurt" amount="" unitLabel="g" costLabel="" onAmountChange={() => undefined} onUnitPress={() => undefined} onNamePress={() => undefined} onRemove={() => undefined} tag="Add-on: Raita" error="Enter how much" />
        <CostBreakdown cost={{ toMake: 312, sellPrice: 650, keep: 338, keepPct: 52, foodCostPct: 48, overTarget: true }} targetPct={40} />
        <CostBreakdown cost={{ toMake: 225, sellPrice: 650, keep: 425, keepPct: 65, foodCostPct: 35, overTarget: false }} targetPct={40} compact />
      </Section>

      <Section title="Kitchen · Forecast and prep">
        {FORECAST.map(f => (
          <ForecastBar key={f.itemId} item={f} max={55} onAdjust={() => undefined} />
        ))}
        <PrepList
          groups={[
            { key: 'meat', title: 'Meat and poultry', lines: [{ id: 'c', name: 'Chicken (curry cut)', qtyLabel: formatQty(9200, 'g'), sub: 'Chicken Biryani, Chicken Tikka' }] },
            { key: 'veg', title: 'Vegetables', lines: [{ id: 'o', name: 'Onion', qtyLabel: formatQty(3400, 'g') }, { id: 't', name: 'Tomato', qtyLabel: formatQty(2750, 'g') }] },
          ]}
          done={done}
          onToggle={id => setDone(d => ({ ...d, [id]: !d[id] }))}
          onShare={() => undefined}
        />
      </Section>

      <Section title="Kitchen · Menu insights">
        <QuadrantChart
          points={[
            { id: '1', label: 'Chicken Biryani', popularity: 0.86, profit: 0.72, quadrant: 'star' },
            { id: '2', label: 'Seekh Kebab', popularity: 0.64, profit: 0.31, quadrant: 'plowhorse' },
            { id: '3', label: 'Malai Boti', popularity: 0.22, profit: 0.8, quadrant: 'puzzle' },
            { id: '4', label: 'Mutton Karahi', popularity: 0.18, profit: 0.2, quadrant: 'dog' },
          ]}
          onPress={() => undefined}
        />
        <HourCurve area={AREA} own={OWN} />
      </Section>

      <Section title="Kitchen · Demand map">
        <DemandHeatmap cells={CELLS} center={{ lat: 31.508, lng: 74.35 }} minCount={10} />
      </Section>

      <Section title="Customers · Bachat Box, tiffin, catering">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          <SurplusCard card={BOX} onPress={() => undefined} rail />
          <SurplusCard card={{ ...BOX, id: 'b2', title: 'Tonight’s handi box', left: 5, vendor: { ...BOX.vendor, name: 'Ammi ka Khana', isHomeKitchen: true } }} onPress={() => undefined} rail />
          <TiffinPlanCard
            plan={{ id: 't', name: 'Weekday lunch', scheduleLabel: 'Lunch · Mon to Fri', priceLabel: 'Rs 2,600 a week', rotation: ['Mon: Daal chawal', 'Tue: Aloo keema', 'Wed: Chicken qorma'], placesLeft: 4, vendorName: 'Ammi ka Khana' }}
            onPress={() => undefined}
            rail
          />
        </ScrollView>
        <QuoteCard
          quote={{
            version: 2,
            lines: [
              { name: 'Chicken Biryani (1 kg)', quantity: 10, unitPrice: 2000, total: 20000 },
              { name: 'Seekh Kebab (4 pcs)', quantity: 15, unitPrice: 850, total: 12750 },
            ],
            deliveryFee: 500,
            total: 33250,
            advancePct: 30,
            advance: 9975,
            validUntilLabel: 'Valid until Fri 23 Oct',
            notes: 'Raita and salad included.',
            stateLabel: 'Current',
            current: true,
          }}
        />
      </Section>

      <Section title="Customers · Nutrition and badges">
        <NutritionBlock facts={{ kcal: 640, protein: 32, carbs: 78, fat: 21, method: 'recipe' }} />
        <BadgeRow badges={['signature', 'hygiene_verified', 'home_kitchen', 'bachat_today', 'under_600', 'high_protein']} />
      </Section>

      <Section title="Customers · My Kitchen">
        <PantryItemRow name="Potato" qtyLabel={formatQty(2000, 'g')} expiresOn={addDays(TODAY, 6)} today={TODAY} onUse={() => undefined} onRemove={() => undefined} />
        <PantryItemRow name="Yoghurt" qtyLabel={formatQty(500, 'g')} expiresOn={addDays(TODAY, 1)} today={TODAY} onUse={() => undefined} onRemove={() => undefined} />
        <RecipeSuggestionCard
          recipe={{ title: 'Aloo anday', minutes: 25, servings: 3, have: ['Potato', 'Eggs', 'Onion'], missing: ['Green chilli'], nutritionLabel: 'About 410 kcal a serving (estimated)', usesExpiring: true }}
          onCook={() => undefined}
          onGetMissing={() => undefined}
          onOrderNearby={() => undefined}
        />
        <RecipeSuggestionCard recipe={{ title: 'دال چاول', minutes: 40, servings: 4, have: ['Rice', 'Masoor daal'], missing: [] }} onCook={() => undefined} onOrderNearby={() => undefined} />
      </Section>
    </>
  );
};

export const KitchenStories: React.FC = () => {
  const [mode, setMode] = useState<'phone' | 'large' | 'tablet'>('phone');
  const large = useMemo(() => withTextScale(getTheme('food'), 1.3), []);
  return (
    <ServiceScope service="food">
      <SegmentTabs
        options={[
          { key: 'phone', label: 'Kitchen · 100%' },
          { key: 'large', label: '130%' },
          { key: 'tablet', label: 'Tablet' },
        ]}
        value={mode}
        onChange={setMode}
        accessibilityLabel="Kitchen preview"
      />
      {mode === 'large' ? (
        <ThemeScope theme={large}>
          <Stories tablet={false} />
        </ThemeScope>
      ) : (
        <Stories tablet={mode === 'tablet'} />
      )}
    </ServiceScope>
  );
};

export default KitchenStories;
