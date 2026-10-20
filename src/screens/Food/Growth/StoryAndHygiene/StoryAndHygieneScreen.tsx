// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen growth: your story and hygiene
// ═══════════════════════════════════════════════════════
// The story customers read on the kitchen's page: who cooks, a few lines,
// up to six photos and one short video. Then the hygiene checklist: six
// plain items, each ticked (a photo is optional evidence). With all six the
// kitchen is "self-declared"; it can ask MetroMatrix to verify it, and the
// "Hygiene verified" badge shows only once staff have.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { MAX_STORY_PHOTOS, STORY_MAX, hygieneProgress, requestBlocker, validateStory } from '@models/kitchen/reachModel';
import { HYGIENE_STATUS } from '@models/kitchen/kitchenStatusModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Button, Card, Checkbox, Divider, InlineNotice, PhotoStrip, ProgressBar, ScreenShell, SkeletonLines, StatusPill, TextAction, TextField } from '@custom/index';
import { SectionHead } from '@components/admin/AdminParts';
import type { FoodVendorStackParamList } from '@/types';
import { pickImageFromLibrary, pickVideoFromLibrary, takePhoto } from '@utils/pickers';
import { formatOn } from '@utils/healthTime';
import { haptics } from '@utils/haptics';
import {
  loadStoryAndHygieneAsync,
  removeStoryPhoto,
  requestVerificationAsync,
  saveStoryAsync,
  selectStoryAndHygiene,
  setHygieneItemAsync,
  setStoryField,
  uploadStoryMediaAsync,
} from './storyAndHygieneSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'GrowthStory'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    tight: { gap: space.s4 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.s12 },
    item: { gap: space.s4, paddingVertical: space.s8 },
    itemActions: { flexDirection: 'row', gap: space.s16, flexWrap: 'wrap' },
  });

const StoryAndHygieneScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <StoryAndHygieneContent {...props} />
  </ServiceScope>
);

const StoryAndHygieneContent: React.FC<Props> = ({ route }) => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'KitchenTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectStoryAndHygiene);
  const focus = route.params?.focus;

  const load = useCallback(() => void dispatch(loadStoryAndHygieneAsync()), [dispatch]);
  useFocusEffect(load);

  if (!s.hygiene || !s.story) {
    return (
      <ScreenShell title="Your story and hygiene" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : <SkeletonLines lines={10} />}
      </ScreenShell>
    );
  }

  const h = s.hygiene;
  const f = s.form;
  const errors = validateStory(f);
  const dirty = JSON.stringify(f) !== JSON.stringify({ text: s.story.text, cookName: s.story.cookName, photoUrls: s.story.photoUrls, videoUrl: s.story.videoUrl });
  const progress = hygieneProgress(h);
  const blocker = requestBlocker(h);

  const addPhoto = async () => {
    const file = await pickImageFromLibrary();
    if (file) void dispatch(uploadStoryMediaAsync({ file, kind: 'photo' }));
  };
  const addVideo = async () => {
    const file = await pickVideoFromLibrary();
    if (file) void dispatch(uploadStoryMediaAsync({ file, kind: 'video' }));
  };
  const save = async () => {
    haptics.press();
    const res = await dispatch(saveStoryAsync(f));
    if (saveStoryAsync.fulfilled.match(res)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Story saved', text2: 'Customers see it on your page.' });
    } else haptics.warning();
  };
  const evidence = async (key: string, camera: boolean) => {
    const file = camera ? await takePhoto() : await pickImageFromLibrary();
    if (file) void dispatch(setHygieneItemAsync({ key, done: true, file }));
  };
  const request = async () => {
    haptics.press();
    const res = await dispatch(requestVerificationAsync());
    if (requestVerificationAsync.fulfilled.match(res)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'Verification requested', text2: 'MetroMatrix staff will look at your checklist.' });
    } else haptics.warning();
  };

  const story = (
    <View style={styles.gap}>
      <SectionHead title="Your story" />
      {s.saveError.message ? <InlineNotice message={s.saveError.message} /> : null}
      <Card>
        <View style={styles.gap}>
          <TextField label="Who cooks" value={f.cookName} onChangeText={v => dispatch(setStoryField({ cookName: v }))} placeholder="Nasreen Begum" error={f.cookName && errors.cookName ? errors.cookName : undefined} />
          <TextField
            label="Your story"
            value={f.text}
            onChangeText={v => dispatch(setStoryField({ text: v }))}
            placeholder="How you started, what you cook, what makes it yours"
            multiline
            numberOfLines={6}
            maxLength={STORY_MAX}
            helper={`${f.text.trim().length} of ${STORY_MAX}`}
            error={f.text && errors.text ? errors.text : undefined}
          />
          <AppText variant="label">{`Photos · up to ${MAX_STORY_PHOTOS}`}</AppText>
          <PhotoStrip
            photos={f.photoUrls.map(u => ({ key: u, uri: u, progress: null }))}
            max={MAX_STORY_PHOTOS}
            onAdd={() => void addPhoto()}
            onRemove={key => dispatch(removeStoryPhoto(key))}
          />
          {s.uploading === 'photo' ? (
            <AppText variant="small" tone="muted">
              Uploading the photo…
            </AppText>
          ) : null}
          <View style={styles.head}>
            <AppText variant="body">{f.videoUrl ? 'A short video is added' : 'A short video (up to a minute)'}</AppText>
            {f.videoUrl ? (
              <TextAction label="Remove" onPress={() => dispatch(setStoryField({ videoUrl: null }))} />
            ) : (
              <TextAction label={s.uploading === 'video' ? 'Uploading…' : 'Add a video'} onPress={() => void addVideo()} />
            )}
          </View>
          {dirty ? <Button label="Save your story" loading={s.saving} disabled={Object.keys(errors).length > 0 || !!s.uploading} onPress={() => void save()} fullWidth /> : null}
          {s.story.updatedAt && !dirty ? (
            <AppText variant="small" tone="muted">
              {`On your page since ${formatOn(s.story.updatedAt)}.`}
            </AppText>
          ) : null}
        </View>
      </Card>
    </View>
  );

  const hygiene = (
    <View style={styles.gap}>
      <SectionHead title="Hygiene" />
      {s.actionError.message ? <InlineNotice title={s.actionError.code === 'HYGIENE_INCOMPLETE' ? 'A few items left' : undefined} message={s.actionError.message} /> : null}
      {h.status === 'rejected' && h.note ? <InlineNotice tone="warning" title="Staff asked for another look" message={h.note} /> : null}
      <Card>
        <View style={styles.gap}>
          <View style={styles.head}>
            <AppText variant="title">{`${progress.done} of ${progress.of} done`}</AppText>
            <StatusPill label={HYGIENE_STATUS[h.status].vendorLabel} tone={HYGIENE_STATUS[h.status].tone} />
          </View>
          <ProgressBar progress={progress.of ? progress.done / progress.of : 0} accessibilityLabel={`${progress.done} of ${progress.of} hygiene items done`} />
          {h.items.map((i, n) => (
            <View key={i.key}>
              {n ? <Divider /> : null}
              <View style={styles.item}>
                <Checkbox
                  checked={i.done}
                  onToggle={next => void dispatch(setHygieneItemAsync({ key: i.key, done: next }))}
                  label={i.label}
                  accessibilityLabel={`${i.label}: ${i.done ? 'done' : 'not done'}`}
                />
                <View style={styles.itemActions}>
                  <AppText variant="small" tone="muted">
                    {s.ticking === i.key ? 'Saving…' : i.evidenceUrl ? 'Photo added' : 'Photo optional'}
                  </AppText>
                  <TextAction label={i.evidenceUrl ? 'Replace the photo' : 'Take a photo'} onPress={() => void evidence(i.key, true)} />
                  <TextAction label="From your photos" onPress={() => void evidence(i.key, false)} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </Card>
      <Card>
        <View style={styles.tight}>
          <AppText variant="title">{h.status === 'verified' ? 'Verified by MetroMatrix' : 'Get it verified'}</AppText>
          <AppText variant="small" tone="muted">
            {h.status === 'verified'
              ? `Your page shows “Hygiene verified”${h.reviewedAt ? ` since ${formatOn(h.reviewedAt)}` : ''}.`
              : 'Until then your page shows “Hygiene self-declared”. Staff check your checklist and photos, then your page shows “Hygiene verified”.'}
          </AppText>
        </View>
      </Card>
      {h.status !== 'verified' ? (
        <>
          <Button label={h.status === 'pending' ? 'Verification requested' : 'Request verification'} loading={s.requesting} disabled={!!blocker} onPress={() => void request()} fullWidth />
          {blocker ? (
            <AppText variant="small" tone="muted">
              {blocker}
            </AppText>
          ) : null}
        </>
      ) : null}
    </View>
  );

  return (
    <ScreenShell title="Your story and hygiene" subtitle="What customers read on your page" onBack={back} refreshing={s.status === 'loading'} onRefresh={load}>
      {focus === 'hygiene' ? (
        <>
          {hygiene}
          {story}
        </>
      ) : (
        <>
          {story}
          {hygiene}
        </>
      )}
    </ScreenShell>
  );
};

export default StoryAndHygieneScreen;
