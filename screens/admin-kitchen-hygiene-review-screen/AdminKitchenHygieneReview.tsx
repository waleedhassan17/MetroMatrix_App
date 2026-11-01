// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: review a hygiene checklist
// ═══════════════════════════════════════════════════════
// One kitchen's six checklist items, each ticked or not, with the story's
// photos. Verify it after a visit or a video call (customers see "Hygiene
// verified"), or take a verification back with a reason the kitchen reads.
// Reads the hygiene checks slice.

import React, { useEffect } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { HYGIENE_STATUS } from '../../models/kitchen/kitchenStatusModel';
import { validateStaffNote } from '../../models/kitchen/adminKitchenModel';
import { formatDate } from '../../utils/dates/dates';
import { cdn } from '../../utils/cdn/cdn';
import { useStyles, useTheme, type Theme } from '../../theme/index';
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
} from '../../Custom-Components/index';
import type { AdminFoodStackParamList } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import {
  loadHygieneAsync,
  markRejectSubmitted,
  openRejectNote,
  reviewHygieneAsync,
  selectAdminKitchenHygiene,
  setRejectNote,
} from '../admin-kitchen-hygiene-screen/adminKitchenHygieneSlice';

type Props = NativeStackScreenProps<AdminFoodStackParamList, 'AdminKitchenHygieneReview'>;

const makeStyles = ({ space, size, radius, colors }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    item: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s8 },
    grow: { flex: 1, gap: space.s4 },
    photo: { width: size.thumb, height: size.thumb, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    photos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  });

const AdminKitchenHygieneReview: React.FC<Props> = ({ route }) => {
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
    if (missing) void dispatch(loadHygieneAsync('self_declared'));
  }, [dispatch, missing]);

  /** Verified after a visit or a video call; or a verification taken back, with the reason the kitchen sees. */
  const review = async (verify: boolean, method?: 'visit' | 'video_call') => {
    if (!h) return;
    if (!verify) {
      dispatch(markRejectSubmitted());
      if (Object.keys(validateStaffNote(s.note)).length) return haptics.warning();
    }
    haptics.press();
    const r = await dispatch(reviewHygieneAsync({ brandId: h.brandId, verify, method, note: s.note }));
    if (reviewHygieneAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: verify ? `${name ?? 'The kitchen'} is verified` : 'Verification taken back' });
      back();
    } else haptics.warning();
  };

  if (!h) {
    return (
      <ScreenShell title={name ?? 'Hygiene check'} onBack={back}>
        {s.status === 'loading' || s.status === 'idle' ? (
          <SkeletonLines lines={8} />
        ) : (
          <InlineNotice tone="info" title="Not on this list any more" message="This kitchen's checklist may have been verified already, or changed since." />
        )}
      </ScreenShell>
    );
  }

  const ticked = h.items.filter(i => i.done).length;
  return (
    <ScreenShell
      title={h.vendor?.name ?? name ?? 'Hygiene check'}
      subtitle={[h.city, h.cookName ? `Cook: ${h.cookName}` : null, h.requestedAt ? `ticked on ${formatDate(h.requestedAt)}` : null].filter(Boolean).join(' · ')}
      onBack={back}
      footer={
        h.status === 'self_declared' ? (
          <View style={styles.gap}>
            <Button label="Verified on a visit" leftIcon="shield-checkmark-outline" loading={s.busy} disabled={ticked < h.items.length} onPress={() => void review(true, 'visit')} fullWidth />
            <Button label="Verified on a video call" variant="secondary" leftIcon="videocam-outline" disabled={s.busy || ticked < h.items.length} onPress={() => void review(true, 'video_call')} fullWidth />
          </View>
        ) : h.status === 'verified' ? (
          <Button label="Take the verification back" variant="secondary" disabled={s.busy} onPress={() => dispatch(openRejectNote(true))} fullWidth />
        ) : undefined
      }>
      {s.actionError.message && !s.noteOpen ? <InlineNotice message={s.actionError.message} /> : null}
      <Card>
        <View style={styles.gap}>
          <View style={styles.item}>
            <AppText variant="title" style={styles.grow}>
              {`${ticked} of ${h.items.length} ticked`}
            </AppText>
            <StatusPill label={h.status === 'self_declared' ? 'To verify' : HYGIENE_STATUS[h.status].vendorLabel} tone={HYGIENE_STATUS[h.status].tone} />
          </View>
          {h.items.map((i, n) => (
            <View key={i.key}>
              {n ? <Divider /> : null}
              <View style={styles.item}>
                <IonIcon name={i.done ? 'checkmark-circle' : 'ellipse-outline'} size="md" color={i.done ? service.accent : colors.inkFaint} />
                <View style={styles.grow}>
                  <AppText variant="body">{i.label}</AppText>
                  {i.key === 'pestControlOn' && i.evidenceUrl ? (
                    <AppText variant="small" tone="muted">
                      {`Last done ${formatDate(i.evidenceUrl)}`}
                    </AppText>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </View>
      </Card>
      {h.photoUrls.length ? (
        <Card>
          <View style={styles.gap}>
            <AppText variant="title">The kitchen’s photos</AppText>
            <View style={styles.photos}>
              {h.photoUrls.map((u, n) => (
                <Image key={u} source={{ uri: cdn(u, { w: size.thumb, h: size.thumb }) ?? undefined }} style={styles.photo} contentFit="cover" accessible accessibilityLabel={`Kitchen photo ${n + 1}`} />
              ))}
            </View>
          </View>
        </Card>
      ) : null}
      {h.note ? <InlineNotice tone="info" title="Verified" message={h.note} /> : null}
      {h.status === 'self_declared' && ticked < h.items.length ? (
        <AppText variant="small" tone="muted">
          Every item needs a tick before the kitchen can be verified.
        </AppText>
      ) : null}
      <AppText variant="caption" tone="muted">
        Verified kitchens show “Hygiene verified” to customers. Taking it back returns them to “Hygiene self-declared”, and they see your reason.
      </AppText>

      <Sheet
        visible={s.noteOpen}
        onClose={() => dispatch(openRejectNote(false))}
        title="Take the verification back?"
        subtitle="The kitchen sees your reason. Its page shows “Hygiene self-declared” again."
        footer={<Button label="Take it back" variant="destructive" loading={s.busy} onPress={() => void review(false)} fullWidth />}>
        {s.actionError.message ? <InlineNotice message={s.actionError.message} /> : null}
        <TextField label="Reason" value={s.note} onChangeText={t => dispatch(setRejectNote(t))} multiline numberOfLines={4} placeholder="A customer reported the kitchen; we will visit again." error={errors.note} />
      </Sheet>
    </ScreenShell>
  );
};

export default AdminKitchenHygieneReview;
