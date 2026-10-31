// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen settings
// ═══════════════════════════════════════════════════════
// The food cost the kitchen aims for, whether a dish sells out by itself
// when stock can't make it, whether a packing photo comes before "ready",
// and whether this device says new orders out loud (and in which language).

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { TARGET_RANGE } from '../../../../models/kitchen/costingModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, IconButton, InlineNotice, ScreenShell, SegmentTabs, SkeletonLines, ToggleRow } from '../../../../Custom-Components/index';
import { SectionHead } from '../../../../Components/admin/AdminParts';
import { selectAnnounce, setAnnounce, type AnnounceLanguage } from '../../../../store/preferencesSlice';
import { announce, hasDeviceVoice } from '../../../../services/announcer';
import type { PackingPhotoRule } from '../../../../types';
import { loadKitchenSettingsAsync, saveKitchenSettingsAsync, selectKitchenSettings } from './kitchenSettingsSlice';

const PACKING: { key: PackingPhotoRule; label: string }[] = [
  { key: 'off', label: 'Off' },
  { key: 'optional', label: 'Optional' },
  { key: 'required', label: 'Required' },
];

const ANNOUNCE: { key: AnnounceLanguage; label: string }[] = [
  { key: 'off', label: 'Off' },
  { key: 'ur', label: 'Urdu' },
  { key: 'en', label: 'English' },
];

const PACKING_HINT: Record<PackingPhotoRule, string> = {
  off: 'No photo step.',
  optional: 'The order page offers a photo before ready.',
  required: 'An order can’t be marked ready without a photo of it packed.',
};

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    group: { gap: space.s12 },
    target: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
  });

const KitchenSettingsScreen: React.FC = () => (
  <ServiceScope service="food">
    <KitchenSettingsContent />
  </ServiceScope>
);

const KitchenSettingsContent: React.FC = () => {
  const { back } = useBack({ name: 'VendorTabs' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectKitchenSettings);
  const spoken = useAppSelector(selectAnnounce);
  const [urduVoice, setUrduVoice] = useState<boolean | null>(null);
  const k = s.settings;

  useEffect(() => {
    void dispatch(loadKitchenSettingsAsync());
    void hasDeviceVoice('ur').then(setUrduVoice);
  }, [dispatch]);

  const target = (n: number) => k && dispatch(saveKitchenSettingsAsync({ targetFoodCostPct: Math.max(TARGET_RANGE.min, Math.min(TARGET_RANGE.max, n)) }));

  return (
    <ScreenShell title="Kitchen settings" subtitle="Costs, stock and the order board" onBack={back}>
      {s.status === 'failed' && !k ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadKitchenSettingsAsync()) }} /> : null}
      {!k && s.status !== 'failed' ? <SkeletonLines lines={6} /> : null}
      {k ? (
        <>
          <View style={styles.group}>
            <SectionHead title="Costs" />
            <Card>
              <View style={styles.target}>
                <View style={styles.grow}>
                  <AppText variant="title">Target food cost: {k.targetFoodCostPct}%</AppText>
                  <AppText variant="small" tone="muted">
                    Dishes that cost more than this share of their price to make are marked.
                  </AppText>
                </View>
                <IconButton icon="remove" tone="muted" onPress={() => target(k.targetFoodCostPct - 1)} disabled={k.targetFoodCostPct <= TARGET_RANGE.min} accessibilityLabel="Lower the target by 1%" />
                <IconButton icon="add" tone="muted" onPress={() => target(k.targetFoodCostPct + 1)} disabled={k.targetFoodCostPct >= TARGET_RANGE.max} accessibilityLabel="Raise the target by 1%" />
              </View>
            </Card>
          </View>
          <View style={styles.group}>
            <SectionHead title="Stock" />
            <Card>
              <ToggleRow
                label="Sell out by stock"
                helper="When the stock can’t make one more serving, customers see the dish as out of stock until you buy more."
                value={k.autoSellOut}
                onChange={autoSellOut => void dispatch(saveKitchenSettingsAsync({ autoSellOut }))}
              />
            </Card>
          </View>
          <View style={styles.group}>
            <SectionHead title="Packing photo" />
            <SegmentTabs options={PACKING} value={k.packingPhoto} onChange={packingPhoto => void dispatch(saveKitchenSettingsAsync({ packingPhoto }))} accessibilityLabel="Packing photo" />
            <AppText variant="small" tone="muted">
              {PACKING_HINT[k.packingPhoto]} The customer sees it on their order.
            </AppText>
          </View>
        </>
      ) : null}
      <View style={styles.group}>
        <SectionHead title="Say new orders out loud (this device)" />
        <SegmentTabs options={ANNOUNCE} value={spoken} onChange={l => dispatch(setAnnounce(l))} accessibilityLabel="Spoken announcements" />
        <AppText variant="small" tone="muted">
          {spoken === 'off'
            ? 'The board rings for a new order; it doesn’t speak.'
            : spoken === 'ur' && urduVoice === false
              ? 'This phone has no Urdu voice. The board plays MetroMatrix’s recording when there is one, or rings.'
              : 'After the ring, the board says the order: what it is and whether it is delivery or pickup.'}
        </AppText>
        {spoken !== 'off' ? (
          <Button
            label="Hear an example"
            variant="secondary"
            leftIcon="volume-high-outline"
            onPress={() =>
              void announce(
                spoken === 'ur'
                  ? { orderId: 'example', text: 'نیا آرڈر۔ 2 Chicken Biryani۔ ڈیلیوری۔', language: 'ur', ttsUrl: null }
                  : { orderId: 'example', text: 'New order. 2 Chicken Biryani. Delivery.', language: 'en', ttsUrl: null },
                0,
              )
            }
          />
        ) : null}
      </View>
      {s.error.message && k ? <InlineNotice message={s.error.message} /> : null}
    </ScreenShell>
  );
};

export default KitchenSettingsScreen;
