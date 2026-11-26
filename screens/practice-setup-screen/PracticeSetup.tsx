// ═══════════════════════════════════════════════════════
// MetroMatrix — Practice setup
// ═══════════════════════════════════════════════════════
// Until patients can find you: the PMDC check (staff), profile photo, about,
// qualifications, at least one location, weekly hours, and a look at what
// patients will see — each row opens its editor and names what's missing.
// Publish lists you, and only when every row is done; Today then says so.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, Card, Divider, IonIcon, InlineNotice, ListRow, ProgressBar, RowCardsSkeleton, ScreenShell, TextAction } from '../../Custom-Components/index';
import type { CompletenessKey, DoctorPartnerStackParamList } from '../../models';
import { haptics } from '../../utils/haptics/haptics';
import { selectBusiness } from '../../store/authSlice';
import { loadCompletenessAsync, publishAsync, selectPracticeSetup } from './practiceSetupSlice';

type Props = NativeStackScreenProps<DoctorPartnerStackParamList, 'PracticeSetup'>;

const HINT: Record<CompletenessKey, string> = {
  pmdc: 'MetroMatrix staff check your number on the PMDC register',
  photo: 'A clear, recent photo of you',
  about: 'Your specialty, languages and a few lines patients read first',
  qualifications: 'Degrees and where you trained',
  location: 'A clinic, or video consultations',
  hours: 'When each location takes patients',
  preview: 'Your next days, as patients see them',
};

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    progress: { gap: space.s8 },
    progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  });

const PracticeSetup: React.FC<Props> = props => (
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
    if (key === 'pmdc') return;
    if (key === 'location') navigation.navigate('Availability', { tab: 'locations' });
    else if (key === 'hours') navigation.navigate('Availability', { tab: 'hours' });
    else if (key === 'preview') navigation.navigate('Availability', { tab: 'preview' });
    else navigation.navigate('DoctorProfileEdit');
  };

  const toTabs = () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'DoctorTabs' }] }));

  const publish = async () => {
    const r = await dispatch(publishAsync());
    if (publishAsync.fulfilled.match(r)) {
      haptics.success();
      // Today greets the newly listed doctor with a notice on the page.
      toTabs();
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
      {s.error.message ? (
        <InlineNotice message={s.error.message} action={!c ? { label: 'Try again', onPress: () => void dispatch(loadCompletenessAsync()) } : undefined} />
      ) : null}
      {!c ? (
        s.status === 'failed' ? null : <RowCardsSkeleton count={5} />
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
                  subtitle={item.detail ?? (item.key === 'pmdc' && !item.done ? 'Waiting for MetroMatrix to check it. Nothing to do on your side.' : HINT[item.key])}
                  left={<IonIcon name={item.done ? 'checkmark-circle' : item.key === 'pmdc' ? 'time-outline' : 'ellipse-outline'} size="lg" color={item.done ? colors.success : colors.lineStrong} />}
                  onPress={item.key === 'pmdc' ? undefined : () => open(item.key)}
                  chevron={item.key !== 'pmdc'}
                />
              </View>
            ))}
          </Card>
          {c.isListed ? (
            <Button label="Go to today" variant="secondary" onPress={toTabs} fullWidth />
          ) : (
            <>
              <AppText variant="small" tone="muted">
                Once listed, patients book you directly and pay you directly; MetroMatrix takes no commission.
              </AppText>
              {/* Booked patients stay reachable while the profile is being finished. */}
              <TextAction label="Go to my appointments" icon="calendar-outline" onPress={toTabs} />
            </>
          )}
        </>
      )}
    </ScreenShell>
  );
};

export default PracticeSetup;
