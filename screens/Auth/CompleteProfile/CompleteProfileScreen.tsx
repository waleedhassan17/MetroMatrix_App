// ═══════════════════════════════════════════════════════
// MetroMatrix — Complete Your Profile (users, after email verification)
// ═══════════════════════════════════════════════════════
// The FYP's three steps with its progress bar + dots and Back / Continue
// buttons. Step 3 is optional: "Finish without a photo" saves without one.
// Customers from before Complete Profile existed (user.profileSkippable) may
// "Skip for now": remembered on this device, and the gate lets them through.

import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { useSignOut } from '../../../hooks/useSignOut';
import { hasErrors, MIN_AGE, validateLocationStep, validatePersonalStep } from '../../../models/authModel';
import { CITIES } from '../../../models/businessModel';
import { visibleErrors } from '../../../utils/formErrors';
import { haptics } from '../../../utils/haptics';
import { pickImageFromLibrary, takePhoto } from '../../../utils/pickers';
import { useStyles, type Theme } from '../../../theme/index';
import {
  AppText,
  Avatar,
  BottomSheetPicker,
  Button,
  DateField,
  InlineNotice,
  PickerField,
  ProgressBar,
  TextField,
  dateKeyOf,
} from '../../../Custom-Components/index';
import { AuthHeader, AuthScreen } from '../../../Components/auth/AuthChrome';
import { OptionPills, StepButtons, StepHeading, StepProgress } from '../../../Components/auth/StepFlow';
import type { Gender } from '../../../types';
import { selectUser } from '../authSlice';
import { skipProfile } from '../../../store/preferencesSlice';
import {
  goToStep,
  removePhoto,
  retryPhotoFile,
  selectCompleteProfile,
  setField,
  setGender,
  submitProfileAsync,
  touch,
  touchStep,
  uploadPhotoAsync,
} from './completeProfileSlice';

const SUBTITLES = { 1: 'Personal information', 2: 'Where are you located?', 3: 'Add a profile photo' } as const;

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const makeStyles = ({ colors, space, radius, size }: Theme) =>
  StyleSheet.create({
    body: { gap: space.s20 },
    photo: {
      alignItems: 'center',
      gap: space.s12,
      padding: space.s24,
      borderRadius: radius.lg,
      borderWidth: size.border,
      borderStyle: 'dashed',
      borderColor: colors.line,
      backgroundColor: colors.surfaceSunk,
    },
    photoActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.s8 },
    progress: { alignSelf: 'stretch' },
    center: { alignItems: 'center' },
  });

/** The latest birthday old enough to sign up. */
const latestBirthday = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_AGE);
  return dateKeyOf(d);
};

const CompleteProfileScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const user = useAppSelector(selectUser);
  const s = useAppSelector(selectCompleteProfile);
  const [cityOpen, setCityOpen] = useState(false);
  const { signOutNow, signingOut } = useSignOut();

  const personalErrors = validatePersonalStep({ dateOfBirth: s.dateOfBirth, gender: s.gender });
  const locationErrors = validateLocationStep({ streetAddress: s.streetAddress, city: s.city, postalCode: s.postalCode });
  const stepErrors = s.step === 1 ? personalErrors : s.step === 2 ? locationErrors : {};
  const shown = visibleErrors({ ...personalErrors, ...locationErrors }, s.touched);
  const loading = s.status === 'loading';
  const uploading = s.photo.status === 'uploading';
  // The FYP's rule: Continue turns green once the step's fields are filled.
  const stepFilled =
    s.step === 1 ? !!s.dateOfBirth && !!s.gender : s.step === 2 ? !!s.streetAddress.trim() && !!s.city : !uploading;

  const pick = async (from: 'library' | 'camera') => {
    const file = from === 'camera' ? await takePhoto() : await pickImageFromLibrary({ square: true });
    if (file) dispatch(uploadPhotoAsync(file));
  };

  const submit = async () => {
    if (!s.gender) return;
    const r = await dispatch(
      submitProfileAsync({
        dateOfBirth: s.dateOfBirth,
        gender: s.gender,
        streetAddress: s.streetAddress,
        city: s.city,
        postalCode: s.postalCode,
        avatarUrl: s.photo.status === 'uploaded' ? s.photo.url : null,
      }),
    );
    if (submitProfileAsync.fulfilled.match(r)) haptics.success();
    else haptics.warning();
  };

  const next = () => {
    if (hasErrors(stepErrors)) {
      dispatch(touchStep());
      haptics.warning();
      return;
    }
    if (s.step < 3) dispatch(goToStep((s.step + 1) as 2 | 3));
    else void submit();
  };

  const nextLabel =
    s.step < 3
      ? 'Continue'
      : loading
        ? 'Saving...'
        : s.photo.status === 'uploaded'
          ? 'Complete Registration'
          : 'Finish without a photo';

  return (
    <AuthScreen onBack={s.step > 1 ? () => dispatch(goToStep((s.step - 1) as 1 | 2)) : undefined}>
      <AuthHeader title="Complete Your Profile" subtitle={SUBTITLES[s.step]} />
      <StepProgress current={s.step} total={3} />
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}

      {s.step === 1 ? (
        <View style={styles.body}>
          <StepHeading title="Personal Information" subtitle={`Hi ${user?.name.split(' ')[0] ?? 'there'}, tell us a little about yourself.`} />
          <DateField
            label="Date of Birth"
            value={s.dateOfBirth}
            onChange={v => {
              dispatch(setField({ field: 'dateOfBirth', value: v }));
              dispatch(touch('dateOfBirth'));
            }}
            max={latestBirthday()}
            min="1906-01-01"
            placeholder="Select your date of birth"
            error={shown.dateOfBirth}
          />
          <OptionPills label="Gender" options={GENDERS} value={s.gender} onChange={g => dispatch(setGender(g))} error={shown.gender} />
        </View>
      ) : null}

      {s.step === 2 ? (
        <View style={styles.body}>
          <StepHeading title="Your Location" subtitle="So we can show what's near you." />
          <TextField
            label="Street Address"
            icon="location-outline"
            value={s.streetAddress}
            onChangeText={v => dispatch(setField({ field: 'streetAddress', value: v }))}
            onBlur={() => dispatch(touch('streetAddress'))}
            error={shown.streetAddress}
            placeholder="Enter your street address"
            autoComplete="street-address"
            textContentType="fullStreetAddress"
          />
          <PickerField
            label="City"
            valueLabel={s.city || null}
            placeholder="Select city"
            onPress={() => setCityOpen(true)}
            error={shown.city}
          />
          <TextField
            label="Postal Code (optional)"
            mode="numeric"
            icon="mail-open-outline"
            value={s.postalCode}
            onChangeText={v => dispatch(setField({ field: 'postalCode', value: v.replace(/\D/g, '').slice(0, 5) }))}
            onBlur={() => dispatch(touch('postalCode'))}
            error={shown.postalCode}
            placeholder="54000"
            autoComplete="postal-code"
            maxLength={5}
          />
          <BottomSheetPicker
            visible={cityOpen}
            onClose={() => setCityOpen(false)}
            title="Select City"
            options={CITIES}
            value={s.city || null}
            onSelect={v => {
              dispatch(setField({ field: 'city', value: v }));
              dispatch(touch('city'));
              setCityOpen(false);
            }}
          />
        </View>
      ) : null}

      {s.step === 3 ? (
        <View style={styles.body}>
          <StepHeading title="Profile Photo (Optional)" subtitle="Help people and partners recognise you." />
          <View style={styles.photo}>
            <Avatar name={user?.name ?? ''} uri={s.photo.previewUri} size="xl" uploading={uploading} />
            <AppText variant="bodyStrong">Upload your photo</AppText>
            <AppText variant="caption" tone="muted">
              JPEG, PNG or WebP · up to 5 MB
            </AppText>
            {uploading ? (
              <View style={styles.progress}>
                <ProgressBar progress={s.photo.progress} accessibilityLabel="Uploading photo" />
              </View>
            ) : null}
            {s.photo.status === 'failed' ? (
              <InlineNotice
                message={s.photo.error ?? 'Upload failed.'}
                action={{
                  label: 'Retry',
                  onPress: () => {
                    const file = retryPhotoFile();
                    if (file) dispatch(uploadPhotoAsync(file));
                  },
                }}
              />
            ) : null}
            <View style={styles.photoActions}>
              <Button
                label={s.photo.previewUri ? 'Change Photo' : 'Choose Photo'}
                variant="secondary"
                size="sm"
                leftIcon="images-outline"
                onPress={() => void pick('library')}
                disabled={uploading || loading}
              />
              {Platform.OS !== 'web' ? (
                <Button
                  label="Take Photo"
                  variant="secondary"
                  size="sm"
                  leftIcon="camera-outline"
                  onPress={() => void pick('camera')}
                  disabled={uploading || loading}
                />
              ) : null}
              {s.photo.previewUri && !uploading ? (
                <Button label="Remove" variant="ghost" size="sm" onPress={() => dispatch(removePhoto())} disabled={loading} />
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      <StepButtons
        onBack={s.step > 1 ? () => dispatch(goToStep((s.step - 1) as 1 | 2)) : undefined}
        onNext={next}
        nextLabel={nextLabel}
        disabled={!stepFilled || loading}
        loading={loading}
      />
      <View style={styles.center}>
        {user?.profileSkippable ? (
          // Accounts from before Complete Profile existed may finish it later.
          <Button label="Skip for now" variant="ghost" size="sm" onPress={() => dispatch(skipProfile(user.id))} />
        ) : null}
        <AppText variant="caption" tone="muted" align="center">
          Signed in as {user?.email}
        </AppText>
        <Button
          label={signingOut ? 'Signing out...' : 'Not you? Sign out'}
          variant="ghost"
          size="sm"
          onPress={() => void signOutNow()}
        />
      </View>
    </AuthScreen>
  );
};

export default CompleteProfileScreen;
