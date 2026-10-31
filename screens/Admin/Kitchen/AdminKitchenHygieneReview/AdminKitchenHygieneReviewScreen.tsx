// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: review a hygiene checklist
// ═══════════════════════════════════════════════════════
// One kitchen's six checklist items, each ticked or not, with the photos it
// sent as evidence. Verify it (customers see "Hygiene verified"), or send
// it back with a note the kitchen reads. Reads the hygiene checks slice.

import React, { useEffect } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { HYGIENE_STATUS } from '../../../../models/kitchen/kitchenStatusModel';
import { validateStaffNote } from '../../../../models/kitchen/adminKitchenModel';
import { formatDate } from '../../../../utils/dates';
import { cdn } from '../../../../utils/cdn';
import { useStyles, useTheme, type Theme } from '../../../../theme/index';
import {
  AppText,
  Button,
  Card,
  Divider,
  InlineNotice,
  IonIcon,
  ScreenShell,
  Sheet,
  SkeletonLines,
  StatusPill,
  TextField,
} from '../../../../Custom-Components/index';
import type { AdminFoodStackParamList } from '../../../../types';
import { haptics } from '../../../../utils/haptics';
import {
  loadHygieneAsync,
  markRejectSubmitted,
  openRejectNote,
  reviewHygieneAsync,
  selectAdminKitchenHygiene,
  setRejectNote,
} from '../AdminKitchenHygiene/adminKitchenHygieneSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminKitchenHygieneReview'>;

const makeStyles = ({ space, size, radius, colors }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    item: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s8 },
    grow: { flex: 1, gap: space.s4 },
    photo: { width: size.thumb, height: size.thumb, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
  });

const AdminKitchenHygieneReviewScreen: React.FC<Props> = ({ route }) => {
  const { businessId, name } = route.params;
  const { back } = useBack({ name: 'AdminKitchenHygiene' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, service, size } = useTheme();
  const s = useAppSelector(selectAdminKitchenHygiene);
  const h = s.items.find(x => x.businessId === businessId) ?? null;
  const errors = s.noteOpen && s.submitted ? validateStaffNote(s.note) : {};

  // Opened from a link: read the waiting checks.
  const missing = !h && s.status === 'idle';
  useEffect(() => {
    if (missing) void dispatch(loadHygieneAsync('pending'));
  }, [dispatch, missing]);

  const review = async (verify: boolean) => {
    if (!verify) {
      dispatch(markRejectSubmitted());
      if (Object.keys(validateStaffNote(s.note)).length) return haptics.warning();
    }
    haptics.press();
    const r = await dispatch(reviewHygieneAsync({ businessId, verify, note: s.note }));
    if (reviewHygieneAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: verify ? `${name ?? 'The kitchen'} is verified` : 'Sent back with your note' });
      back();
    } else haptics.warning();
  };

  if (!h) {
    return (
      <ScreenShell title={name ?? 'Hygiene check'} onBack={back}>
        {s.status === 'loading' || s.status === 'idle' ? (
          <SkeletonLines lines={8} />
        ) : (
          <InlineNotice tone="info" title="Not waiting any more" message="This kitchen's checklist isn't waiting for a check. It may have been reviewed already." />
        )}
      </ScreenShell>
    );
  }

  const ticked = h.items.filter(i => i.done).length;
  return (
    <ScreenShell
      title={h.vendor?.name ?? name ?? 'Hygiene check'}
      subtitle={`${h.vendor?.isHomeKitchen ? 'Home kitchen' : 'Kitchen'}${h.requestedAt ? ` · asked on ${formatDate(h.requestedAt)}` : ''}`}
      onBack={back}
      footer={
        h.status === 'pending' ? (
          <View style={styles.gap}>
            <Button label="Verify hygiene" leftIcon="shield-checkmark-outline" loading={s.busy && !s.noteOpen} disabled={ticked < h.items.length} onPress={() => void review(true)} fullWidth />
            <Button label="Send back with a note" variant="secondary" disabled={s.busy} onPress={() => dispatch(openRejectNote(true))} fullWidth />
          </View>
        ) : undefined
      }>
      {s.actionError.message && !s.noteOpen ? <InlineNotice message={s.actionError.message} /> : null}
      <Card>
        <View style={styles.gap}>
          <View style={styles.item}>
            <AppText variant="title" style={styles.grow}>
              {`${ticked} of ${h.items.length} ticked`}
            </AppText>
            <StatusPill label={h.status === 'pending' ? 'Waiting' : HYGIENE_STATUS[h.status].vendorLabel} tone={HYGIENE_STATUS[h.status].tone} />
          </View>
          {h.items.map((i, n) => (
            <View key={i.key}>
              {n ? <Divider /> : null}
              <View style={styles.item}>
                <IonIcon name={i.done ? 'checkmark-circle' : 'ellipse-outline'} size="md" color={i.done ? service.accent : colors.inkFaint} />
                <View style={styles.grow}>
                  <AppText variant="body">{i.label}</AppText>
                  <AppText variant="small" tone="muted">
                    {i.evidenceUrl ? 'Photo sent' : 'No photo'}
                  </AppText>
                </View>
                {i.evidenceUrl ? (
                  <Image
                    source={{ uri: cdn(i.evidenceUrl, { w: size.thumb, h: size.thumb }) ?? undefined }}
                    style={styles.photo}
                    contentFit="cover"
                    accessible
                    accessibilityLabel={`Evidence photo: ${i.label}`}
                  />
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </Card>
      {h.note ? <InlineNotice tone="info" title="The last note" message={h.note} /> : null}
      {h.status === 'pending' && ticked < h.items.length ? (
        <AppText variant="small" tone="muted">
          Every item needs a tick before the kitchen can be verified.
        </AppText>
      ) : null}
      <AppText variant="caption" tone="muted">
        Verified kitchens show “Hygiene verified” to customers. A kitchen sent back sees your note and can ask again.
      </AppText>

      <Sheet
        visible={s.noteOpen}
        onClose={() => dispatch(openRejectNote(false))}
        title="What needs fixing?"
        subtitle="The kitchen sees this note and can ask again once it's fixed."
        footer={<Button label="Send back" variant="destructive" loading={s.busy} onPress={() => void review(false)} fullWidth />}>
        {s.actionError.message ? <InlineNotice message={s.actionError.message} /> : null}
        <TextField label="Note to the kitchen" value={s.note} onChangeText={t => dispatch(setRejectNote(t))} multiline numberOfLines={4} placeholder="The storage photo doesn't show the fridge temperature." error={errors.note} />
      </Sheet>
    </ScreenShell>
  );
};

export default AdminKitchenHygieneReviewScreen;
