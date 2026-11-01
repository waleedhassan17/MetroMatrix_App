// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: signature dishes
// ═══════════════════════════════════════════════════════
// Customers see a kitchen's signature dishes first, with the cook's name.
// New ones (and ones changed since) wait here: keep the label, or take it
// off with a note the kitchen reads (another kitchen's dish, a misleading
// name).

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { SIGNATURE_STATUS, SIGNATURE_TABS, validateStaffNote } from '../../models/kitchen/adminKitchenModel';
import { formatDate } from '../../utils/dates/dates';
import { useStyles, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  InlineNotice,
  ScreenShell,
  SegmentTabs,
  Sheet,
  SkeletonLines,
  TextAction,
  TextField,
} from '../../Custom-Components/index';
import { RowCard } from '../../Components/admin/AdminParts';
import type { AdminFoodStackParamList } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import {
  loadSignaturesAsync,
  markRemoveSubmitted,
  openRemoveNote,
  reviewSignatureAsync,
  selectAdminKitchenSignatures,
  setRemoveNote,
  setSignaturesTab,
} from './adminKitchenSignaturesSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminKitchenSignatures'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.s12 },
    actions: { flexDirection: 'row', gap: space.s16, paddingTop: space.s8 },
  });

const AdminKitchenSignatures: React.FC<Props> = () => {
  const { back } = useBack({ name: 'FoodOverview' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectAdminKitchenSignatures);
  const l = s.list;
  const errors = s.removing && s.submitted ? validateStaffNote(s.note) : {};

  const load = useCallback(() => void dispatch(loadSignaturesAsync(s.tab)), [dispatch, s.tab]);
  useFocusEffect(load);

  const remove = () => {
    if (!s.removing) return;
    dispatch(markRemoveSubmitted());
    if (Object.keys(validateStaffNote(s.note)).length) return haptics.warning();
    void dispatch(reviewSignatureAsync({ recipeCardId: s.removing.recipeCardId, note: s.note, tab: s.tab }));
  };

  const tabs = SIGNATURE_TABS.map(t => ({ key: t.key, label: l ? `${t.label} · ${l.counts[t.key]}` : t.label }));

  return (
    <ScreenShell
      title="Signature dishes"
      subtitle="What kitchens say they're known for"
      onBack={back}
      refreshing={s.status === 'loading' && !!l}
      onRefresh={load}
      headerContent={<SegmentTabs options={tabs} value={s.tab} onChange={t => dispatch(setSignaturesTab(t))} accessibilityLabel="Which signature dishes" />}>
      {s.error.message ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : null}
      {s.actionError.message && !s.removing ? <InlineNotice message={s.actionError.message} /> : null}
      {!l && s.status !== 'failed' ? <SkeletonLines lines={6} /> : null}
      <View style={styles.list}>
        {l?.items.map(d => (
          <RowCard
            key={d.recipeCardId}
            title={d.name}
            mark={{ icon: 'ribbon-outline', tint: 'amber' }}
            lines={[
              d.vendor?.name,
              d.creatorName ? `By ${d.creatorName}${d.since ? `, since ${formatDate(d.since)}` : ''}` : null,
              d.reviewedAt ? `${SIGNATURE_STATUS[d.status].label} on ${formatDate(d.reviewedAt)}` : null,
              d.note ? `Note: ${d.note}` : null,
            ]}
            pill={SIGNATURE_STATUS[d.status]}>
            {d.status !== 'removed' ? (
              <View style={styles.actions}>
                <TextAction label="Take the label off" tone="danger" onPress={() => dispatch(openRemoveNote({ recipeCardId: d.recipeCardId, name: d.name }))} />
              </View>
            ) : null}
          </RowCard>
        ))}
      </View>
      {l && !l.items.length ? (
        <AppText variant="body">{s.tab === 'claimed' ? 'No kitchen claims a signature dish yet.' : 'No labels taken off.'}</AppText>
      ) : null}

      <Sheet
        visible={!!s.removing}
        onClose={() => dispatch(openRemoveNote(null))}
        title={s.removing ? `Take the label off ${s.removing.name}?` : 'Take the label off?'}
        subtitle="The dish stays on the menu without it. The kitchen sees your note."
        footer={<Button label="Take it off" variant="destructive" loading={!!s.busy} onPress={remove} fullWidth />}>
        {s.actionError.message ? <InlineNotice message={s.actionError.message} /> : null}
        <TextField label="Why" value={s.note} onChangeText={t => dispatch(setRemoveNote(t))} multiline numberOfLines={3} placeholder="The same dish is sold by another kitchen under its name." error={errors.note} />
      </Sheet>
    </ScreenShell>
  );
};

export default AdminKitchenSignatures;
