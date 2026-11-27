// ═══════════════════════════════════════════════════════
// MetroMatrix — More (every practice tool beyond the tabs)
// ═══════════════════════════════════════════════════════
// Your listing on top (patients can find you or not, the link to share, hide
// or show again), then menu groups under overline titles whose rows take the
// FYP's categorical icon colours: Your practice · Patients · Account. Sign out
// is the one destructive row, and asks first.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useSignOut } from '../../hooks/useSignOut';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Avatar, Card, Divider, IonIcon, InlineNotice, ListRow, ScreenShell, StatusPill, TextAction, type IonName } from '../../Custom-Components/index';
import { loadDoctorFeaturesAsync, selectDoctorFeatures } from '../../store/doctorFeaturesSlice';
import { selectBusiness } from '../../store/authSlice';
import { Alert } from '../../utils/alert/alert';
import { shareText } from '../../utils/share-text/shareText';
import { loadListingAsync, selectDoctorMore, setListedAsync } from './doctorMoreSlice';

type Nav = { navigate: (name: string, params?: object) => void };

interface Item {
  label: string;
  hint?: string;
  icon: IonName;
  to: string;
  params?: object;
}

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Your practice',
    items: [
      { label: 'Availability', hint: 'Locations, weekly hours, preview', icon: 'time-outline', to: 'Availability' },
      { label: 'Time off', hint: 'Days you won’t see patients', icon: 'sunny-outline', to: 'TimeOff' },
      { label: 'Your profile', hint: 'Photo, qualifications, booking rules', icon: 'medkit-outline', to: 'DoctorProfileEdit' },
      { label: 'Payment accounts', hint: 'Where patients send transfers', icon: 'card-outline', to: 'PaymentAccounts' },
      { label: 'Practice setup', hint: 'The checklist patients need', icon: 'checkmark-done-outline', to: 'PracticeSetup' },
    ],
  },
  {
    title: 'Patients',
    items: [
      { label: 'Reviews', hint: 'Read and reply', icon: 'star-outline', to: 'MyReviews' },
      { label: 'Insights', hint: 'Visits, wait times, recorded fees', icon: 'stats-chart-outline', to: 'DoctorInsights' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Notifications', icon: 'notifications-outline', to: 'Notifications' },
      { label: 'My account', hint: 'Name, phone, password', icon: 'person-circle-outline', to: 'Profile' },
    ],
  },
];

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    section: { gap: space.s12 },
    hero: { flexDirection: 'row', alignItems: 'center', gap: space.s16 },
    verified: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    grow: { flex: 1, gap: space.s0 },
  });

const DoctorMore: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const business = useAppSelector(selectBusiness);
  const s = useAppSelector(selectDoctorMore);
  const { confirmSignOut } = useSignOut();
  const listing = s.listing;
  const me = useAppSelector(selectDoctorFeatures).me;
  const { service } = useTheme();

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadListingAsync());
      // The identity on the hero, and the features (retried if the first read failed).
      void dispatch(loadDoctorFeaturesAsync());
    }, [dispatch]),
  );

  const share = async () => {
    if (!listing) return;
    const name = business?.name ?? 'My practice';
    const outcome = await shareText(`${name} on MetroMatrix. Book a visit: metromatrix://health/doctor/${listing.id}`, 'Share your profile');
    if (outcome === 'copied') Toast.show({ type: 'success', text1: 'Link copied' });
    else if (outcome === 'failed') Toast.show({ type: 'error', text1: "The link didn't share", text2: 'Try again.' });
  };

  const hide = () =>
    Alert.alert('Hide your profile from patients?', "New patients can't find or book you until you show it again. Visits already booked stay booked.", [
      { text: 'Keep it visible', style: 'cancel' },
      {
        text: 'Hide',
        style: 'destructive',
        onPress: () =>
          void dispatch(setListedAsync(false)).then(r => {
            if (setListedAsync.fulfilled.match(r)) Toast.show({ type: 'success', text1: 'Your profile is hidden', text2: 'Show it again here whenever you like.' });
          }),
      },
    ]);

  const show = () =>
    void dispatch(setListedAsync(true)).then(r => {
      if (setListedAsync.fulfilled.match(r)) Toast.show({ type: 'success', text1: 'Patients can find you again' });
    });

  return (
    <ServiceScope service="healthcare">
      <ScreenShell title="More" subtitle={business?.name}>
        {s.error.message ? (
          <InlineNotice
            message={s.error.message}
            action={!listing ? { label: 'Try again', onPress: () => void dispatch(loadListingAsync()) } : undefined}
          />
        ) : null}

        {me ? (
          <Card>
            <View style={styles.hero}>
              <Avatar name={me.name.replace(/^(Prof\. |Assoc\. Prof\. |Asst\. Prof\. )?Dr\. /, '')} uri={me.photoUrl} size="lg" />
              <View style={styles.grow}>
                <AppText variant="title" numberOfLines={1}>
                  {me.name}
                </AppText>
                {me.specialtyName ? (
                  <AppText variant="small" tone="muted" numberOfLines={1}>
                    {me.specialtyName}
                  </AppText>
                ) : null}
                {/* Listed doctors were checked against the PMDC register before approval. */}
                <View style={styles.verified}>
                  <IonIcon name="checkmark-circle" size="sm" color={service.accent} />
                  <AppText variant="small" tone="accentDeep">
                    PMDC verified
                  </AppText>
                </View>
              </View>
            </View>
            <TextAction label="See what patients see" icon="eye-outline" onPress={() => navigation.navigate('Availability', { tab: 'preview' })} />
          </Card>
        ) : null}

        {listing ? (
          <View style={styles.section}>
            <AppText variant="sectionTitle">
              Your listing
            </AppText>
            <Card padded="horizontal">
              <ListRow
                title={listing.isListed ? 'Patients can find you' : 'Hidden from patients'}
                subtitle={
                  listing.hiddenByStaff
                    ? `MetroMatrix took your profile off the directory: ${listing.hiddenByStaff}. Contact support.`
                    : listing.isListed
                      ? 'You show in search and can be booked.'
                      : "New patients can't find or book you."
                }
                leftIcon={listing.isListed ? 'eye-outline' : 'eye-off-outline'}
                right={<StatusPill label={listing.isListed ? 'Listed' : 'Hidden'} tone={listing.isListed ? 'success' : 'warning'} />}
                chevron={false}
              />
              {listing.isListed ? (
                <>
                  <Divider />
                  <ListRow title="Share your profile" subtitle="A link patients can book from" leftIcon="share-social-outline" onPress={() => void share()} chevron={false} />
                  <Divider />
                  <ListRow title="Hide from patients" leftIcon="eye-off-outline" onPress={hide} chevron={false} accessibilityHint="Asks first" />
                </>
              ) : !listing.hiddenByStaff ? (
                <>
                  <Divider />
                  <ListRow title={s.busy ? 'Showing your profile…' : 'Show to patients'} leftIcon="eye-outline" onPress={s.busy ? undefined : show} chevron={false} />
                </>
              ) : null}
            </Card>
          </View>
        ) : null}

        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <AppText variant="sectionTitle">
              {section.title}
            </AppText>
            <Card padded="horizontal">
              {section.items.map((it, i) => (
                <View key={it.label}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow title={it.label} subtitle={it.hint} leftIcon={it.icon} onPress={() => navigation.navigate(it.to, it.params)} />
                </View>
              ))}
            </Card>
          </View>
        ))}
        <Card padded="horizontal">
          <ListRow title="Sign out" leftIcon="log-out-outline" destructive onPress={confirmSignOut} chevron={false} />
        </Card>
      </ScreenShell>
    </ServiceScope>
  );
};

export default DoctorMore;
