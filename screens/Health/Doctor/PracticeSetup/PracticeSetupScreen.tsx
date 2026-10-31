// ═══════════════════════════════════════════════════════
// MetroMatrix — Practice setup
// ═══════════════════════════════════════════════════════
// Until patients can find you: profile photo, about, qualifications,
// services and conditions, at least one location, weekly hours, and a look
// at what patients will see — each row opens its editor. Publish lists you,
// and only when every row is done.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, Divider, IonIcon, InlineNotice, ListRow, ProgressBar, ScreenShell, SkeletonLines, TextAction } from '../../../../Custom-Components/index';
import type { CompletenessKey, DoctorPartnerStackParamList } from '../../../../types';
import { haptics } from '../../../../utils/haptics';
import { selectBusiness } from '../../../Auth/authSlice';
import { loadCompletenessAsync, publishAsync, selectPracticeSetup } from './practiceSetupSlice';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'PracticeSetup'>;

const HINT: Record<CompletenessKey, string> = {
  photo: 'A clear, recent photo of you',
  about: 'A few lines patients read first',
  qualifications: 'Degrees and where you trained',
  services: 'What you offer, and the conditions you treat',
  location: 'A clinic, or video consultations',
  hours: 'When each location takes patients',
  preview: 'Your next days, as patients see them',
};

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    progress: { gap: space.s8 },
    progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  });

const PracticeSetupScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <PracticeSetupContent {...props} />
  </ServiceScope>
);

const PracticeSetupContent: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const s = useAppSelector(selectPracticeSetup);
  const c = s.completeness;
  // A doctor not yet listed lives here (no way round it); once listed, back goes to More.
  const listed = !!useAppSelector(selectBusiness)?.isListed;
  const { back } = useBack({ name: 'DoctorTabs', params: { screen: 'MoreTab' } });
  const canGoBack = listed || navigation.canGoBack();

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadCompletenessAsync());
    }, [dispatch]),
  );

  const open = (key: CompletenessKey) => {
    if (key === 'location') navigation.navigate('Availability', { tab: 'locations' });
    else if (key === 'hours') navigation.navigate('Availability', { tab: 'hours' });
    else if (key === 'preview') navigation.navigate('Availability', { tab: 'preview' });
    else navigation.navigate('DoctorProfileEdit');
  };

  const publish = async () => {
    const r = await dispatch(publishAsync());
    if (publishAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: 'You are listed', text2: 'Patients can find and book you now.' });
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'DoctorTabs' }] }));
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title="Practice setup"
      subtitle={c?.isListed ? 'You are listed for patients' : 'Finish these so patients can book you'}
      onBack={canGoBack ? back : undefined}
      headerRight={!canGoBack ? <TextAction label="Account" icon="person-circle-outline" onPress={() => navigation.navigate('Profile')} /> : undefined}
      footer={
        c && !c.isListed ? (
          <Button label={c.percent === 100 ? 'Publish my profile' : `Publish (${c.percent}% done)`} onPress={() => void publish()} disabled={!c.canPublish} loading={s.publishing} fullWidth />
        ) : undefined
      }
      refreshing={s.status === 'loading' && !!c}
      onRefresh={() => void dispatch(loadCompletenessAsync())}>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      {!c ? (
        <SkeletonLines lines={8} />
      ) : (
        <>
          <View style={styles.progress}>
            <View style={styles.progressHead}>
              <AppText variant="title">{c.percent === 100 ? 'All done' : `${c.items.filter(i => i.done).length} of ${c.items.length} done`}</AppText>
              <AppText variant="bodyStrong" tone="accentDeep">{`${c.percent}%`}</AppText>
            </View>
            <ProgressBar progress={c.percent / 100} accessibilityLabel={`Practice setup ${c.percent}% done`} />
          </View>
          <Card padded="horizontal">
            {c.items.map((item, i) => (
              <View key={item.key}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={item.label}
                  subtitle={HINT[item.key]}
                  left={<IonIcon name={item.done ? 'checkmark-circle' : 'ellipse-outline'} size="lg" color={item.done ? colors.success : colors.lineStrong} />}
                  onPress={() => open(item.key)}
                  chevron
                />
              </View>
            ))}
          </Card>
          {c.isListed ? (
            <Button label="Go to today" variant="secondary" onPress={() => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'DoctorTabs' }] }))} fullWidth />
          ) : (
            <AppText variant="small" tone="muted">
              MetroMatrix checks your PMDC registration before you are approved. Once listed, patients book you directly and pay you directly; MetroMatrix takes no commission.
            </AppText>
          )}
        </>
      )}
    </ScreenShell>
  );
};

export default PracticeSetupScreen;
