// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin: Food Court review moderation
// ═══════════════════════════════════════════════════════
// Customers' reviews of vendors, newest first: on vendors' pages or
// hidden, low ratings only, one vendor's. Hide one that breaks the rules
// (abuse, personal details, not about the order) with a reason; a hidden
// review leaves the vendor's page and rating at once. Unhide puts it back.

import React, { useEffect } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { usePagedList } from '../../../../hooks/usePagedList';
import { getAdminFoodReviewsAPI } from '../../../../networks/admin/adminFoodNetwork';
import { HIDE_REVIEW_REASONS, validateHideFoodReview } from '../../../../models/food/adminFoodModel';
import { useStyles, type Theme } from '../../../../theme/index';
import {
  Button,
  Card,
  ChoiceChip,
  EmptyState,
  InlineNotice,
  ScreenShell,
  SegmentTabs,
  Sheet,
  SkeletonLines,
  TextField,
} from '../../../../Custom-Components/index';
import { FoodReviewItem } from '../../../../Custom-Components/food/FoodReviewItem';
import type { AdminFoodReview, AdminFoodStackParamList } from '../../../../types';
import { haptics } from '../../../../utils/haptics';
import {
  moderateFoodReviewAsync,
  openHideFoodReview,
  selectAdminFoodReviews,
  setFoodHideReason,
  setFoodReviewsHidden,
  setFoodReviewsLowOnly,
  setFoodReviewsVendor,
  touchFoodHideReason,
} from './adminFoodReviewsSlice';
import { adminFoodReviewsPageSerializer } from '../../../../serializers/food/adminFoodSerializer';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminFoodReviews'>;

const SEGMENTS: { key: 'visible' | 'hidden'; label: string }[] = [
  { key: 'visible', label: 'On vendor pages' },
  { key: 'hidden', label: 'Hidden' },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    chipBar: { flexGrow: 0, flexShrink: 0 },
    chips: { gap: space.s8 },
    list: { gap: space.s12, paddingTop: space.s4, paddingBottom: space.s40 },
    actions: { flexDirection: 'row', gap: space.s12 },
    reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const AdminFoodReviewsScreen: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAdminFoodReviews);
  const list = usePagedList(
    (page, size) =>
      getAdminFoodReviewsAPI({ hidden: s.hidden, maxRating: s.lowOnly ? 2 : undefined, vendorId: s.vendor?.id }, page, size),
    adminFoodReviewsPageSerializer,
    `admin-food-reviews|${s.hidden}|${s.lowOnly}|${s.vendor?.id}`,
  );
  const reasonError = s.reasonTouched ? validateHideFoodReview(s.reason).reason : undefined;
  const hiding = list.rows.find(r => r.id === s.hiding) ?? null;

  useEffect(() => {
    if (route.params?.vendorId)
      dispatch(
        setFoodReviewsVendor({ id: route.params.vendorId, name: route.params.name ?? null }),
      );
  }, [dispatch, route.params?.vendorId, route.params?.name]);

  const moderate = async (r: AdminFoodReview, hide: boolean) => {
    if (hide && Object.keys(validateHideFoodReview(s.reason)).length) {
      dispatch(touchFoodHideReason());
      haptics.warning();
      return;
    }
    const res = await dispatch(
      moderateFoodReviewAsync({ id: r.id, hide, reason: hide ? s.reason : null }),
    );
    if (moderateFoodReviewAsync.fulfilled.match(res)) {
      haptics.success();
      list.setRows(rows => rows.filter(x => x.id !== r.id));
      Toast.show({
        type: 'success',
        text1: hide ? 'Review hidden' : 'Review back on the vendor’s page',
        text2: hide ? 'It no longer counts toward the rating.' : undefined,
      });
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title="Reviews"
      subtitle={
        s.vendor?.name
          ? `${s.vendor.name} · Food Court`
          : 'Food Court · what customers say about vendors'
      }
      onBack={back}
      scroll={false}
      headerContent={
        <>
          <SegmentTabs
            options={SEGMENTS}
            value={s.hidden ? 'hidden' : 'visible'}
            onChange={k => dispatch(setFoodReviewsHidden(k === 'hidden'))}
            accessibilityLabel="Reviews"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipBar}
            contentContainerStyle={styles.chips}>
            <ChoiceChip
              label="2 stars or fewer"
              selected={s.lowOnly}
              onPress={() => dispatch(setFoodReviewsLowOnly(!s.lowOnly))}
            />
            {s.vendor ? (
              <ChoiceChip
                label={s.vendor.name ?? 'This vendor'}
                icon="close"
                selected
                onPress={() => dispatch(setFoodReviewsVendor(null))}
              />
            ) : null}
          </ScrollView>
        </>
      }>
      {s.error.message && !s.hiding ? <InlineNotice message={s.error.message} /> : null}
      <FlatList
        data={list.rows}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        onRefresh={list.refresh}
        refreshing={list.isRefreshing}
        onEndReached={list.loadMore}
        renderItem={({ item: r }) => (
          <Card padded="horizontal">
            <FoodReviewItem
              review={r}
              vendorName="The vendor"
              author={r.author ?? 'Customer'}
              context={
                [
                  r.orderCode ? `Order ${r.orderCode}` : null,
                  r.isHidden && r.hiddenReason ? `Hidden: ${r.hiddenReason}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined
              }
              footer={
                <View style={styles.actions}>
                  {r.isHidden ? (
                    <Button
                      label="Unhide"
                      variant="secondary"
                      onPress={() => void moderate(r, false)}
                      loading={s.busy === r.id}
                    />
                  ) : (
                    <Button
                      label="Hide"
                      variant="secondary"
                      leftIcon="eye-off-outline"
                      onPress={() => dispatch(openHideFoodReview(r.id))}
                    />
                  )}
                </View>
              }
            />
          </Card>
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <SkeletonLines lines={6} />
          ) : list.error ? (
            <InlineNotice
              message={list.error}
              action={{ label: 'Try again', onPress: list.reload }}
            />
          ) : (
            <EmptyState
              icon="message-square"
              title={s.hidden ? 'Nothing hidden' : 'No reviews here'}
              body="Customers' reviews of vendors show here."
            />
          )
        }
      />
      <Sheet
        visible={!!s.hiding}
        onClose={() => dispatch(openHideFoodReview(null))}
        title="Hide this review?"
        subtitle="It leaves the vendor's page and rating at once. The vendor isn't told who hid it."
        footer={
          <Button
            label="Hide review"
            variant="destructive"
            loading={!!s.busy}
            onPress={() => hiding && void moderate(hiding, true)}
            fullWidth
          />
        }>
        <View style={styles.reasons}>
          {HIDE_REVIEW_REASONS.map(reason => (
            <ChoiceChip
              key={reason}
              label={reason}
              selected={s.reason === reason}
              onPress={() => dispatch(setFoodHideReason(reason))}
            />
          ))}
        </View>
        <TextField
          label="Reason"
          value={s.reason}
          onChangeText={t => dispatch(setFoodHideReason(t))}
          multiline
          placeholder="Why it breaks the rules"
          error={reasonError}
          helper="Kept with the review for other staff."
        />
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      </Sheet>
    </ScreenShell>
  );
};

export default AdminFoodReviewsScreen;
