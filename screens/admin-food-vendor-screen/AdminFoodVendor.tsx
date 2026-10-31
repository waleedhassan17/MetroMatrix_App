// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: one Food Court vendor
// ═══════════════════════════════════════════════════════
// Where the vendor stands and the staff moves: feature it on the home,
// suspend it (hidden at once; the owner and customers with an active order
// are told) or reinstate it, record a home kitchen's food-safety check, and
// change the plan's limits. Then, read-only: setup, ratings and complaints,
// recent orders, how it works (hours, zones), and the menu.

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import {
  PLAN_ENTITLEMENT_FIELDS,
  PLAN_LIMIT_FIELDS,
  REINSTATE_REASONS,
  SUSPEND_REASONS,
  planOverridesFrom,
  validatePlanLimits,
  validateSafetyNote,
  validateSuspendReason,
  vendorStanding,
} from '../../models/food/adminFoodModel';
import { ORDER_STATUS, orderStatusLabel } from '../../models/food/foodStatusModel';
import { KITCHEN_KIND_NAME, WEEK, rangeLabel, setupTitle } from '../../models/food/vendorModel';
import { useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  Card,
  ChoiceChip,
  Divider,
  IonIcon,
  InlineNotice,
  ScreenShell,
  SegmentTabs,
  Sheet,
  SkeletonLines,
  StatusPill,
  TextAction,
  TextField,
  ToggleRow,
} from '../../Custom-Components/index';
import { FoodReviewItem } from '../../Custom-Components/food/FoodReviewItem';
import { RatingSummary } from '../../Custom-Components/food/RatingSummary';
import type { AdminFoodStackParamList, AdminFoodVendor } from '../../models';
import { formatDate } from '../../utils/dates/dates';
import { haptics } from '../../utils/haptics/haptics';
import { formatPKR } from '../../utils/money/money';
import {
  loadAdminFoodVendorAsync,
  moveVendorAsync,
  openVendorSheet,
  seedFeatured,
  selectAdminFoodVendorEntry,
  selectAdminFoodVendorUi,
  setPlanEntitlement,
  setPlanLimit,
  setSafetyNote,
  setSafetyOutcome,
  setVendorReason,
  touchVendorSheet,
} from './adminFoodVendorSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminFoodVendor'>;

const OUTCOMES: { key: 'passed' | 'failed'; label: string }[] = [
  { key: 'passed', label: 'Passed' },
  { key: 'failed', label: 'Not yet' },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    grow: { flex: 1, gap: space.s4 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s12,
      paddingVertical: space.s8,
    },
    check: { flexDirection: 'row', alignItems: 'center', gap: space.s8, paddingVertical: space.s4 },
    reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    actions: { gap: space.s8 },
  });

/** "Riders: 1 of 25". */
const usageLine = (v: AdminFoodVendor, key: string, label: string) =>
  v.plan ? `${label}: ${v.plan.usage[key] ?? 0} of ${v.plan.limits[key] ?? 0}` : label;

const AdminFoodVendorScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id, name, featured: featuredParam } = route.params;
  const { back } = useBack({ name: 'AdminFoodVendors' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const ui = useAppSelector(selectAdminFoodVendorUi);
  const { vendor: v, status, error } = useAppSelector(st => selectAdminFoodVendorEntry(st, id));

  useFocusEffect(
    useCallback(() => {
      if (featuredParam !== undefined) dispatch(seedFeatured({ id, featured: featuredParam }));
      void dispatch(loadAdminFoodVendorAsync(id));
    }, [dispatch, id, featuredParam]),
  );

  if (!v) {
    return (
      <ScreenShell title={name ?? 'Vendor'} onBack={back}>
        {status === 'failed' ? (
          <InlineNotice
            message={error.message}
            action={{
              label: 'Try again',
              onPress: () => void dispatch(loadAdminFoodVendorAsync(id)),
            }}
          />
        ) : (
          <SkeletonLines lines={10} />
        )}
      </ScreenShell>
    );
  }

  const p = v.profile;
  const standing = vendorStanding({
    businessStatus: v.businessStatus,
    branchStatus: p?.branch.status ?? 'draft',
    isPaused: p?.branch.isPaused ?? false,
  });
  const suspended = v.businessStatus === 'suspended';
  const isHomeKitchen = v.subType === 'home_kitchen';
  const featured = ui.featured[id];
  const reasonErrors = ui.touched ? validateSuspendReason(ui.reason) : {};
  const noteErrors = ui.touched ? validateSafetyNote(ui.note) : {};
  const limitErrors = validatePlanLimits(ui.limits);

  const run = async (move: Parameters<typeof moveVendorAsync>[0]['move'], done: string) => {
    const r = await dispatch(moveVendorAsync({ id, move }));
    if (moveVendorAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: done });
    } else haptics.warning();
  };

  const submitSheet = () => {
    dispatch(touchVendorSheet());
    if (ui.sheet === 'suspend' || ui.sheet === 'reinstate') {
      if (Object.keys(validateSuspendReason(ui.reason)).length) return haptics.warning();
      void run(
        { kind: 'suspend', suspend: ui.sheet === 'suspend', reason: ui.reason },
        ui.sheet === 'suspend' ? 'Vendor suspended' : 'Vendor reinstated',
      );
    } else if (ui.sheet === 'safety' && p) {
      if (Object.keys(validateSafetyNote(ui.note)).length) return haptics.warning();
      void run(
        { kind: 'safety', branchId: p.branch.id, outcome: ui.safetyOutcome, note: ui.note },
        ui.safetyOutcome === 'passed' ? 'Food-safety check recorded' : 'Recorded: not passed yet',
      );
    } else if (ui.sheet === 'plan') {
      if (Object.keys(limitErrors).length) return haptics.warning();
      const overrides = planOverridesFrom(ui.limits, ui.entitlements);
      void run(
        { kind: 'plan', overrides: Object.keys(overrides).length ? overrides : null },
        'Plan updated',
      );
    }
  };

  return (
    <ScreenShell
      title={p?.name ?? name ?? 'Vendor'}
      subtitle={[v.subTypeLabel || KITCHEN_KIND_NAME[v.subType], v.settings?.location.city]
        .filter(Boolean)
        .join(' · ')}
      onBack={back}
      refreshing={status === 'loading'}
      onRefresh={() => void dispatch(loadAdminFoodVendorAsync(id))}>
      {ui.error.message && !ui.sheet ? <InlineNotice message={ui.error.message} /> : null}
      <Card>
        <View style={styles.head}>
          <View style={styles.grow}>
            <AppText variant="small" tone="muted">
              {v.ownerEmail ?? 'No owner email'}
            </AppText>
            {p?.branch.wentLiveAt ? (
              <AppText variant="caption" tone="muted">
                {`Live since ${formatDate(p.branch.wentLiveAt)}`}
              </AppText>
            ) : null}
          </View>
          <StatusPill label={standing.label} tone={standing.tone} />
        </View>
        {suspended && v.suspensionReason ? (
          <InlineNotice tone="warning" title="Suspended" message={v.suspensionReason} />
        ) : null}
        {p?.branch.isPaused ? (
          <InlineNotice
            tone="info"
            message={`Paused by the vendor${
              p.branch.pauseMessage ? `: ${p.branch.pauseMessage}` : ''
            }.`}
          />
        ) : null}
        <ToggleRow
          label="Featured on the Food Court home"
          helper="Featured vendors lead the lists customers see."
          value={!!featured}
          onChange={on =>
            void run({ kind: 'feature', featured: on }, on ? 'Featured' : 'No longer featured')
          }
          disabled={ui.busy === 'feature' || suspended}
        />
        <View style={styles.actions}>
          {suspended ? (
            <Button
              label="Reinstate"
              variant="secondary"
              leftIcon="refresh"
              onPress={() => dispatch(openVendorSheet({ sheet: 'reinstate' }))}
              fullWidth
            />
          ) : v.businessStatus === 'approved' ? (
            <Button
              label="Suspend"
              variant="destructive"
              leftIcon="pause-circle-outline"
              onPress={() => dispatch(openVendorSheet({ sheet: 'suspend' }))}
              fullWidth
            />
          ) : null}
        </View>
      </Card>

      {isHomeKitchen ? (
        <Card>
          <AppText variant="title">Food-safety check</AppText>
          <AppText variant="small" tone="muted">
            {p?.branch.foodSafetyCheckedAt
              ? `Passed on ${formatDate(p.branch.foodSafetyCheckedAt)}. `
              : 'Not passed yet. '}
            A home kitchen can go live only after staff record a passed check.
          </AppText>
          <Button
            label="Record a check"
            variant="secondary"
            leftIcon="shield-checkmark-outline"
            onPress={() => dispatch(openVendorSheet({ sheet: 'safety' }))}
            fullWidth
          />
        </Card>
      ) : null}

      {v.setup ? (
        <Card>
          <View style={styles.row}>
            <AppText variant="title">Setup</AppText>
            <AppText variant="small" tone="muted">{`${v.setup.percent}%`}</AppText>
          </View>
          {v.setup.items.map(it => (
            <View
              key={it.key}
              style={styles.check}
              accessible
              accessibilityLabel={`${setupTitle(it.key, it.label)}: ${
                it.done ? 'done' : 'not done'
              }`}>
              <IonIcon
                name={it.done ? 'checkmark-circle' : 'ellipse-outline'}
                size="sm"
                color={it.done ? colors.success : colors.inkFaint}
              />
              <AppText variant="small">{setupTitle(it.key, it.label)}</AppText>
            </View>
          ))}
        </Card>
      ) : null}

      {v.plan ? (
        <Card>
          <View style={styles.row}>
            <AppText variant="title">{`${v.plan.label} plan`}</AppText>
            <AppText variant="small" tone="muted">
              {v.plan.price ? formatPKR(v.plan.price) : 'Free'}
            </AppText>
          </View>
          {PLAN_LIMIT_FIELDS.map(f => (
            <AppText key={f.key} variant="small">
              {usageLine(v, f.key, f.label)}
            </AppText>
          ))}
          {PLAN_ENTITLEMENT_FIELDS.filter(f => v.plan!.entitlements[f.key] === false).map(f => (
            <AppText key={f.key} variant="small" tone="warning">{`${f.label}: turned off`}</AppText>
          ))}
          {Object.keys(v.plan.overrides).length ? (
            <AppText variant="caption" tone="muted">
              Staff changes are in effect.
            </AppText>
          ) : null}
          <TextAction
            label="Change limits"
            icon="options-outline"
            onPress={() => dispatch(openVendorSheet({ sheet: 'plan', vendor: v }))}
          />
        </Card>
      ) : null}

      {v.ratings ? (
        <Card>
          <AppText variant="title">Ratings</AppText>
          {v.ratings.ratingCount ? (
            <RatingSummary summary={v.ratings} />
          ) : (
            <AppText variant="small" tone="muted">
              No ratings yet.
            </AppText>
          )}
          {v.complaints.length ? (
            <>
              <AppText variant="label">Complaints (2 stars or fewer)</AppText>
              {v.complaints.slice(0, 3).map(c => (
                <FoodReviewItem
                  key={c.id}
                  review={c}
                  vendorName={p?.name ?? 'The vendor'}
                  context={
                    [c.orderCode ? `Order ${c.orderCode}` : null, c.isHidden ? 'Hidden' : null]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  }
                />
              ))}
            </>
          ) : null}
          <TextAction
            label="Moderate this vendor's reviews"
            icon="chatbox-ellipses-outline"
            onPress={() =>
              navigation.navigate('AdminFoodReviews', { vendorId: v.id, name: p?.name })
            }
          />
        </Card>
      ) : null}

      <Card>
        <AppText variant="title">Recent orders</AppText>
        {v.recentOrders.length ? (
          v.recentOrders.map((o, i) => (
            <View key={o.id}>
              {i > 0 ? <Divider /> : null}
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate('AdminFoodOrder', { id: o.id, code: o.code })}
                accessibilityRole="button"
                accessibilityLabel={`Order ${o.code}, ${orderStatusLabel(o.status, o.fulfilment)}`}>
                <View style={styles.grow}>
                  <AppText variant="bodyStrong">{o.code}</AppText>
                  <AppText variant="caption" tone="muted">
                    {`${ORDER_STATUS[o.status].label} · ${formatDate(o.placedAt)}`}
                  </AppText>
                </View>
                <AppText variant="body">{formatPKR(o.total)}</AppText>
              </Pressable>
            </View>
          ))
        ) : (
          <AppText variant="small" tone="muted">
            No orders yet.
          </AppText>
        )}
        <TextAction
          label="All this vendor's orders"
          icon="receipt-outline"
          onPress={() => navigation.navigate('AdminFoodOrders', { vendorId: v.id, name: p?.name })}
        />
      </Card>

      {v.settings ? (
        <Card>
          <AppText variant="title">How it works</AppText>
          <AppText variant="small">
            {[
              v.settings.acceptsDelivery ? 'Delivers' : null,
              v.settings.acceptsPickup ? 'Pick-up' : null,
              v.settings.acceptsCod ? `Cash up to ${formatPKR(v.settings.codLimit)}` : 'No cash',
            ]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
          <AppText variant="small" tone="muted">
            {`Prep ${v.settings.prepMinutes} min · answers within ${v.settings.autoRejectMinutes} min · delivers up to ${v.settings.maxRadiusKm} km`}
          </AppText>
          <AppText variant="small" tone="muted">
            {[v.settings.location.addressLine, v.settings.location.area, v.settings.location.city]
              .filter(Boolean)
              .join(', ')}
          </AppText>
          {v.feeBands.map(b => (
            <AppText key={`${b.fromKm}-${b.toKm}`} variant="small">{`${b.fromKm}–${b.toKm} km: ${
              b.fee ? formatPKR(b.fee) : 'free'
            } delivery, min ${formatPKR(b.minOrder)}`}</AppText>
          ))}
          <Divider />
          {WEEK.map(d => {
            const ranges = v.hours.filter(h => h.weekday === d.weekday);
            return (
              <View key={d.weekday} style={styles.row}>
                <AppText variant="small">{d.short}</AppText>
                <AppText variant="small" tone="muted">
                  {ranges.length ? ranges.map(rangeLabel).join(', ') : 'Closed'}
                </AppText>
              </View>
            );
          })}
        </Card>
      ) : null}

      {v.menu.length ? (
        <Card>
          <AppText variant="title">Menu</AppText>
          {v.menu.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.grow}>
                <AppText variant="bodyStrong">{`${c.name}${
                  c.isActive ? '' : ' (hidden)'
                }`}</AppText>
                <AppText variant="small" tone="muted">
                  {c.items.length
                    ? c.items
                        .map(
                          it =>
                            `${it.name} ${formatPKR(it.basePrice)}${it.isActive ? '' : ' (off)'}`,
                        )
                        .join(' · ')
                    : 'No dishes'}
                </AppText>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <Sheet
        visible={ui.sheet === 'suspend' || ui.sheet === 'reinstate'}
        onClose={() => dispatch(openVendorSheet({ sheet: null }))}
        title={ui.sheet === 'suspend' ? 'Suspend this vendor?' : 'Reinstate this vendor?'}
        subtitle={
          ui.sheet === 'suspend'
            ? 'It disappears from Food Court at once. The owner, and every customer with an active order, is told.'
            : 'It comes back to Food Court as it was. The owner is told.'
        }
        footer={
          <Button
            label={ui.sheet === 'suspend' ? 'Suspend' : 'Reinstate'}
            variant={ui.sheet === 'suspend' ? 'destructive' : 'primary'}
            loading={!!ui.busy && ui.busy !== 'feature'}
            onPress={submitSheet}
            fullWidth
          />
        }>
        <View style={styles.reasons}>
          {(ui.sheet === 'suspend' ? SUSPEND_REASONS : REINSTATE_REASONS).map(r => (
            <ChoiceChip
              key={r}
              label={r}
              selected={ui.reason === r}
              onPress={() => dispatch(setVendorReason(r))}
            />
          ))}
        </View>
        <TextField
          label="Reason"
          value={ui.reason}
          onChangeText={t => dispatch(setVendorReason(t))}
          multiline
          placeholder="What the owner is told"
          error={reasonErrors.reason}
        />
        {ui.error.message ? <InlineNotice message={ui.error.message} /> : null}
      </Sheet>

      <Sheet
        visible={ui.sheet === 'safety'}
        onClose={() => dispatch(openVendorSheet({ sheet: null }))}
        title="Record a food-safety check"
        subtitle="What staff saw at the kitchen. A passed check lets it go live."
        footer={
          <Button
            label="Record check"
            loading={!!ui.busy && ui.busy !== 'feature'}
            onPress={submitSheet}
            fullWidth
          />
        }>
        <SegmentTabs
          options={OUTCOMES}
          value={ui.safetyOutcome}
          onChange={k => dispatch(setSafetyOutcome(k))}
          accessibilityLabel="Outcome"
        />
        <TextField
          label="Note"
          value={ui.note}
          onChangeText={t => dispatch(setSafetyNote(t))}
          multiline
          placeholder="Kitchen visited; storage and hygiene fine"
          error={noteErrors.note}
        />
        {ui.error.message ? <InlineNotice message={ui.error.message} /> : null}
      </Sheet>

      <Sheet
        visible={ui.sheet === 'plan'}
        onClose={() => dispatch(openVendorSheet({ sheet: null }))}
        title="Change the plan's limits"
        subtitle="Takes effect at once. Riders beyond a lowered limit are signed out; one on a delivery keeps the seat. Leave a box empty for the plan's own limit."
        footer={
          <Button
            label="Save"
            loading={!!ui.busy && ui.busy !== 'feature'}
            onPress={submitSheet}
            fullWidth
          />
        }>
        {PLAN_LIMIT_FIELDS.map(f => (
          <TextField
            key={f.key}
            label={f.label}
            value={ui.limits[f.key] ?? ''}
            onChangeText={t => dispatch(setPlanLimit({ key: f.key, value: t }))}
            keyboardType="number-pad"
            placeholder={v.plan ? String(v.plan.limits[f.key] ?? '') : undefined}
            error={limitErrors[f.key]}
          />
        ))}
        {PLAN_ENTITLEMENT_FIELDS.map(f => (
          <ToggleRow
            key={f.key}
            label={f.label}
            helper={f.helper}
            value={ui.entitlements[f.key] !== false}
            onChange={on => dispatch(setPlanEntitlement({ key: f.key, on }))}
          />
        ))}
        {ui.error.message ? <InlineNotice message={ui.error.message} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default AdminFoodVendorScreen;
