// ═══════════════════════════════════════════════════════
// MetroMatrix — Design Gallery (dev only)
// ═══════════════════════════════════════════════════════
// One story per design-system component, under a live mode toggle and a
// service switcher. Registered only when __DEV__ (navigations-maps/Auth.ts).
// Demo values are local state on purpose: nothing here is app data.

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { ServiceScope, useStyles, useTheme, type ServiceName, type Theme } from '../../../theme/index';
import type { RootStackParamList } from '../../../types';
import {
  AppText,
  Avatar,
  BottomSheetPicker,
  Button,
  Card,
  Checkbox,
  Divider,
  DocumentUploadTile,
  EmptyState,
  GoogleButton,
  ImageCard,
  ImageViewer,
  ListRow,
  OtpInput,
  PasswordStrength,
  PickerField,
  ProgressBar,
  ScreenShell,
  SegmentTabs,
  Sheet,
  SkeletonLines,
  Skeleton,
  StatusPill,
  StatusTimeline,
  TextField,
} from '../../../Custom-Components/index';
import { BrandMark, BrandWordmark } from '../../../Components/brand';
import { AuthHeader, AuthTabs, ProviderBadge, type AuthTab } from '../../../Components/auth/AuthChrome';
import { selectPreviewService, setPreviewService } from './designGallerySlice';
import { ShoppingStories } from './ShoppingStories';
import { HealthStories } from './HealthStories';
import { KitchenStories } from './KitchenStories';

type Props = NativeStackScreenProps<RootStackParamList, 'DesignGallery'>;

const SAMPLE_IMAGE = require('../../../assets/images/icon.png');

const SERVICES: { key: ServiceName; label: string }[] = [
  { key: 'neutral', label: 'Neutral' },
  { key: 'shopping', label: 'Shop' },
  { key: 'healthcare', label: 'Health' },
  { key: 'food', label: 'Food' },
];

const CITIES = [
  { value: 'lahore', label: 'Lahore' },
  { value: 'karachi', label: 'Karachi' },
  { value: 'islamabad', label: 'Islamabad' },
];

const makeStyles = ({ space, colors, radius, size }: Theme) =>
  StyleSheet.create({
    section: { gap: space.s12, paddingTop: space.s16 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8, alignItems: 'center' },
    swatch: {
      width: size.avatar.md,
      height: size.avatar.md,
      borderRadius: radius.sm,
      borderWidth: size.hairline,
      borderColor: colors.line,
    },
    swatchCell: { alignItems: 'center', gap: space.s4 },
    listInset: { paddingHorizontal: space.s16 },
  });

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <AppText variant="micro" tone="muted">
        {title}
      </AppText>
      {children}
    </View>
  );
};

const Swatches: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const entries: [string, string][] = [
    ['canvas', colors.canvas],
    ['surface', colors.surface],
    ['sunk', colors.surfaceSunk],
    ['ink', colors.ink],
    ['muted', colors.inkMuted],
    ['line', colors.line],
    ['accent', service.accent],
    ['soft', service.accentSoft],
    ['danger', colors.danger],
    ['success', colors.success],
    ['warning', colors.warning],
  ];
  return (
    <View style={styles.row}>
      {entries.map(([name, value]) => (
        <View key={name} style={styles.swatchCell}>
          <View style={[styles.swatch, { backgroundColor: value }]} />
          <AppText variant="micro" tone="muted">
            {name}
          </AppText>
        </View>
      ))}
    </View>
  );
};

const Stories: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const [text, setText] = useState('');
  const [email, setEmail] = useState('not-an-email');
  const [password, setPassword] = useState('Metro2026!');
  const [phone, setPhone] = useState('3124890176');
  const [otp, setOtp] = useState('12');
  const [checked, setChecked] = useState(true);
  const [segment, setSegment] = useState<'all' | 'pending' | 'done'>('all');
  const [city, setCity] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>('signin');

  return (
    <>
      <Section title="Brand">
        <View style={styles.row}>
          <BrandMark size={size.thumb} />
          <BrandWordmark variant="compact" />
        </View>
        <BrandWordmark variant="display" />
      </Section>

      <Section title="Auth">
        <AuthHeader
          title="Welcome Back"
          subtitle="Sign in to continue your registration"
          badge={<ProviderBadge label="Home kitchen" service="food" />}
        />
        <AuthTabs value={authTab} onChange={setAuthTab} />
      </Section>

      <Section title="Colour">
        <Swatches />
      </Section>

      <Section title="Type">
        <AppText variant="display">Your city, without the middleman.</AppText>
        <AppText variant="h1">Large title</AppText>
        <AppText variant="h2">Section title</AppText>
        <AppText variant="title">Card title</AppText>
        <AppText variant="body">Body — shops, doctors and kitchens near you.</AppText>
        <AppText variant="bodyStrong">Body strong</AppText>
        <AppText variant="small" tone="muted">
          Small meta and helper text
        </AppText>
        <AppText variant="micro" tone="accentDeep">
          Micro overline
        </AppText>
      </Section>

      <Section title="Buttons">
        <Button label="Primary" onPress={() => undefined} fullWidth />
        <Button label="Secondary" variant="secondary" onPress={() => undefined} fullWidth />
        <Button label="Ghost" variant="ghost" onPress={() => undefined} />
        <Button label="Delete account" variant="destructive" onPress={() => undefined} fullWidth />
        <View style={styles.row}>
          <Button label="Small" size="sm" onPress={() => undefined} />
          <Button label="Medium" size="md" onPress={() => undefined} />
          <Button label="Large" size="lg" onPress={() => undefined} />
        </View>
        <View style={styles.row}>
          <Button label="Saving changes" loading onPress={() => undefined} />
          <Button label="Disabled" disabled onPress={() => undefined} />
        </View>
        <GoogleButton onPress={() => undefined} />
      </Section>

      <Section title="Fields">
        <TextField label="Full name" value={text} onChangeText={setText} placeholder="Ayesha Khan" clearable icon="person-outline" />
        <TextField label="Email" mode="email" value={email} onChangeText={setEmail} error="Enter a valid email address" />
        <TextField label="Password" mode="password" value={password} onChangeText={setPassword} />
        <PasswordStrength password={password} />
        <TextField label="Mobile number" mode="phone" value={phone} onChangeText={setPhone} helper="We text order updates here" />
        <PickerField label="City" valueLabel={CITIES.find(c => c.value === city)?.label ?? null} placeholder="Choose a city" onPress={() => setPickerOpen(true)} />
        <OtpInput value={otp} onChange={setOtp} autoFocus={false} />
        <Checkbox checked={checked} onToggle={setChecked} label="I agree to the Terms and Privacy Policy" accessibilityLabel="Accept terms" />
      </Section>

      <Section title="Selection">
        <SegmentTabs
          options={[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'done', label: 'Done' },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </Section>

      <Section title="Surfaces">
        <Card>
          <AppText variant="title">Card, hairline</AppText>
          <AppText variant="body" tone="muted">
            Elevation none — the default for content.
          </AppText>
        </Card>
        <Card elevation="float">
          <AppText variant="title">Card, float</AppText>
        </Card>
        <ImageCard image={SAMPLE_IMAGE} title="Al-Noor Pharmacy" subtitle="Gulberg III, Lahore" onPress={() => setViewerOpen(true)} />
        <Card padded="horizontal">
          <View>
            <ListRow title="Notifications" subtitle="Order and approval updates" leftIcon="notifications-outline" onPress={() => undefined} />
            <Divider />
            <ListRow title="Theme" value="System" leftIcon="moon-outline" onPress={() => undefined} />
            <Divider />
            <ListRow title="Sign out" leftIcon="log-out-outline" destructive onPress={() => undefined} />
          </View>
        </Card>
        <Divider label="or" />
      </Section>

      <Section title="Status">
        <View style={styles.row}>
          <StatusPill label="Pending" tone="warning" />
          <StatusPill label="Approved" tone="success" />
          <StatusPill label="Rejected" tone="danger" />
          <StatusPill label="Draft" />
          <StatusPill label="New" tone="accent" />
        </View>
        <StatusTimeline
          steps={[
            { label: 'Submitted', description: '14 Oct, 10:42', state: 'done' },
            { label: 'Under review', description: 'Usually within 24 hours', state: 'current' },
            { label: 'Approved', state: 'upcoming' },
          ]}
        />
        <ProgressBar progress={0.62} />
      </Section>

      <Section title="People">
        <View style={styles.row}>
          <Avatar name="Ayesha Khan" size="sm" />
          <Avatar name="Ayesha Khan" size="md" />
          <Avatar name="Bilal Ahmed" size="lg" editable onPress={() => undefined} />
          <Avatar name="Sana" size="xl" uri={null} />
        </View>
      </Section>

      <Section title="Documents">
        <DocumentUploadTile label="CNIC — front" state="empty" onPick={() => undefined} />
        <DocumentUploadTile label="CNIC — back" state="uploading" progress={0.45} onPick={() => undefined} />
        <DocumentUploadTile label="PMDC registration certificate" state="uploading" progress={0.3} error="Upload failed. Check your connection." onRetry={() => undefined} onPick={() => undefined} />
        <DocumentUploadTile label="Storefront photo" state="uploaded" thumbnailUri={null} onPick={() => undefined} onRemove={() => undefined} onView={() => setViewerOpen(true)} />
        <DocumentUploadTile label="Medical degree" state="rejected" note="The scan is cropped. Upload the full page." onPick={() => undefined} />
        <DocumentUploadTile label="Food authority licence" state="empty" highlighted onPick={() => undefined} />
      </Section>

      <Section title="Loading">
        <Skeleton height={120} shape="lg" />
        <SkeletonLines lines={3} />
      </Section>

      <Section title="Empty">
        <EmptyState icon="shopping-bag" title="Nothing here yet" body="Coming in the next update." action={{ label: 'Refresh', onPress: () => undefined }} />
      </Section>

      <ShoppingStories />

      <HealthStories />

      <KitchenStories />

      <Section title="Overlays">
        <Button label="Open sheet" variant="secondary" onPress={() => setSheetOpen(true)} />
        <Button label="Success toast" variant="secondary" onPress={() => Toast.show({ type: 'success', text1: 'Password updated', text2: 'Sign in with your new password.' })} />
        <Button label="Error toast" variant="secondary" onPress={() => Toast.show({ type: 'error', text1: 'Upload failed', text2: 'Check your connection and try again.' })} />
        <Button label="Open image viewer" variant="secondary" onPress={() => setViewerOpen(true)} />
      </Section>

      <BottomSheetPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Choose a city"
        options={CITIES}
        value={city}
        onSelect={setCity}
      />
      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Reject application"
        subtitle="The partner sees this reason."
        footer={<Button label="Reject" variant="destructive" onPress={() => setSheetOpen(false)} fullWidth />}>
        <TextField label="Reason" value={text} onChangeText={setText} multiline />
      </Sheet>
      <ImageViewer visible={viewerOpen} uri={null} title="Storefront photo" onClose={() => setViewerOpen(false)} />
    </>
  );
};

const DesignGalleryScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const service = useAppSelector(selectPreviewService);

  return (
    <ServiceScope service={service}>
      <ScreenShell
        eyebrow="Developer"
        title="Design gallery"
        subtitle="Quiet Metro, every component."
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        footer={<Button label="Sticky call to action" onPress={() => undefined} fullWidth />}>
        <SegmentTabs options={SERVICES} value={service} onChange={s => dispatch(setPreviewService(s))} accessibilityLabel="Service accent" />
        <Stories />
      </ScreenShell>
    </ServiceScope>
  );
};

export default DesignGalleryScreen;
