// ═══════════════════════════════════════════════════════
// MetroMatrix — Personal Info (providers, after email verification)
// ═══════════════════════════════════════════════════════
// The FYP's provider-info screen: three steps with its progress bar + dots,
// the provider-type badge, and Back / Continue. The fields of step 2 and the
// documents of step 3 come from businessModel for the provider's sub-type.

import React, { useEffect, useRef } from 'react';
import { Linking, Platform, StyleSheet, View, type TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useSignOut } from '@hooks/useSignOut';
import { hasErrors, validateProviderBasics } from '@models/authModel';
import {
  BUSINESS_FORM_SCHEMA,
  CITIES,
  DOCUMENT_LABELS,
  SUBTYPE_SERVICE,
  allDetailFields,
  documentSlots,
  missingDocuments,
  providerTypeLabel,
  requirementLabel,
  validateBusinessProfile,
  type DetailFieldSpec,
  type DocumentSlot,
} from '@models/businessModel';
import { visibleErrors } from '@utils/formErrors';
import { haptics } from '@utils/haptics';
import { pickDocumentFile, pickImageFromLibrary, takePhoto } from '@utils/pickers';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import {
  AppText,
  BottomSheetPicker,
  Button,
  DocumentUploadTile,
  ImageViewer,
  InlineNotice,
  ListRow,
  PickerField,
  Sheet,
  TextField,
  type DocumentTileState,
} from '@custom/index';
import { AuthHeader, AuthScreen, ProviderBadge } from '@components/auth/AuthChrome';
import { StepButtons, StepHeading, StepProgress } from '@components/auth/StepFlow';
import type { BusinessDocument, LocalFile, RootStackParamList } from '@/types';
import { selectBusiness, selectUser } from '../../Auth/authSlice';
import { selectPendingPick } from '../../ProviderSelection/providerSelectionSlice';
import {
  dismissError,
  goToStep,
  initialise,
  choosePickingKind,
  openDocumentPicker,
  openPicker,
  openViewer,
  removeDocumentAsync,
  retryUploadFor,
  saveBasicsAsync,
  saveProfessionalAsync,
  selectPersonalInfo,
  setBasic,
  setCoreField,
  setDetail,
  submitApplicationAsync,
  touch,
  touchFields,
  uploadDocumentAsync,
} from './personalInfoSlice';
import { ERROR_CODES } from '@networks/network/apiHelpers';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalInfo'>;

const STEP_COPY = {
  1: { title: 'Personal Information', subtitle: 'Tell us about yourself' },
  2: { title: 'Professional Details', subtitle: 'Your expertise and credentials' },
  3: { title: 'Upload Documents', subtitle: 'Verify your credentials' },
} as const;

const isPdf = (doc: Pick<BusinessDocument, 'mimeType' | 'url'>) =>
  doc.mimeType === 'application/pdf' || doc.url.toLowerCase().endsWith('.pdf');

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    body: { gap: space.s20 },
    center: { alignItems: 'center' },
  });

const PersonalInfoScreen: React.FC<Props> = ({ route, navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const user = useAppSelector(selectUser);
  const business = useAppSelector(selectBusiness);
  const s = useAppSelector(selectPersonalInfo);
  const { signOutNow, signingOut } = useSignOut();
  const phoneRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);

  const pending = useAppSelector(selectPendingPick);
  const subType = business?.subType ?? pending?.subType ?? user?.providerSubType ?? 'store';
  const serviceType = business?.serviceType ?? pending?.serviceType ?? user?.providerServiceType ?? SUBTYPE_SERVICE[subType];
  const schema = BUSINESS_FORM_SCHEMA[subType];
  const paramStep = route.params?.step;
  const paramHighlight = route.params?.highlight;

  // No service known (no business, no saved pick): choose it rather than guess.
  const serviceUnknown = !business && !pending && !user?.providerSubType;
  useEffect(() => {
    if (serviceUnknown) navigation.replace('ProviderSelection');
  }, [serviceUnknown, navigation]);

  useEffect(() => {
    if (user) dispatch(initialise({ user, business, step: paramStep, highlight: paramHighlight }));
    // Only on arrival and when the account / draft changes identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, user?.id, business?.id, paramStep, paramHighlight]);

  if (!user || serviceUnknown) return null;

  const basicErrors = validateProviderBasics({ name: s.fullName, phone: s.phone });
  const proErrors = validateBusinessProfile(subType, s.form);
  const shown = visibleErrors(
    { ...(basicErrors.name ? { fullName: basicErrors.name } : {}), ...(basicErrors.phone ? { phone: basicErrors.phone } : {}), ...proErrors },
    s.touched,
  );
  const busy = s.status === 'loading';
  const submitting = s.submitStatus === 'loading';
  const documents = business?.documents ?? [];
  const slots = documentSlots(subType, documents);
  const missing = missingDocuments(subType, documents);
  const filledSlots = slots.filter(slot => slot.doc && slot.doc.status !== 'rejected').length;
  const uploading = Object.values(s.uploads).some(u => u?.status === 'uploading');
  const back = s.step > 1 ? () => dispatch(goToStep((s.step - 1) as 1 | 2)) : undefined;

  // ── Step actions ──
  const next = async () => {
    if (s.step === 1) {
      if (hasErrors(basicErrors)) {
        dispatch(touchFields(['fullName', 'phone']));
        haptics.warning();
        return;
      }
      const r = await dispatch(saveBasicsAsync({ user, fullName: s.fullName, phone: s.phone }));
      if (saveBasicsAsync.rejected.match(r)) haptics.warning();
      return;
    }
    if (s.step === 2) {
      if (hasErrors(proErrors)) {
        dispatch(touchFields(['name', 'city', 'address', ...allDetailFields(subType).map(f => f.key)]));
        haptics.warning();
        return;
      }
      const r = await dispatch(
        saveProfessionalAsync({ business, serviceType, subType, form: s.form, phone: user.phone ?? '' }),
      );
      if (saveProfessionalAsync.rejected.match(r)) haptics.warning();
      return;
    }
    const r = await dispatch(submitApplicationAsync());
    if (submitApplicationAsync.fulfilled.match(r)) haptics.success();
    else haptics.warning();
  };

  const stepFilled =
    s.step === 1
      ? !!s.fullName.trim() && !!s.phone.trim()
      : s.step === 2
        ? !!s.form.name.trim() && !!s.form.city && !!s.form.address.trim()
        : missing.length === 0 && !uploading;

  const nextLabel =
    s.step < 3 ? (busy ? 'Saving...' : 'Continue') : submitting ? 'Submitting...' : business?.status === 'rejected' ? 'Resubmit Application' : 'Submit Application';

  // ── Documents ──
  const upload = async (file: LocalFile | null) => {
    const picking = s.pickingFor;
    dispatch(openDocumentPicker(null));
    if (!file || !picking) return;
    const r = await dispatch(uploadDocumentAsync({ slot: picking.slot, kind: picking.kind, file, replacing: picking.replacing }));
    if (uploadDocumentAsync.fulfilled.match(r)) haptics.success();
    else haptics.warning();
  };

  const view = (doc: BusinessDocument) => {
    if (isPdf(doc)) void Linking.openURL(doc.url);
    else dispatch(openViewer({ uri: doc.url, title: DOCUMENT_LABELS[doc.kind].label }));
  };

  const tileFor = (slot: DocumentSlot) => {
    const pending = s.uploads[slot.key];
    const { doc } = slot;
    const state: DocumentTileState = pending ? 'uploading' : doc ? (doc.status === 'rejected' ? 'rejected' : 'uploaded') : 'empty';
    const pick = () => dispatch(openDocumentPicker({ slot: slot.key, kinds: slot.kinds, replacing: doc?.id ?? null }));
    return (
      <DocumentUploadTile
        key={slot.key}
        label={doc && slot.kinds.length > 1 ? `${slot.label} · ${DOCUMENT_LABELS[doc.kind].label}` : slot.label}
        hint={slot.hint}
        state={state}
        progress={pending?.progress}
        error={pending?.error}
        thumbnailUri={pending ? pending.previewUri : doc && !isPdf(doc) ? doc.url : null}
        isPdf={pending ? pending.isPdf : doc ? isPdf(doc) : false}
        note={doc?.reviewerNote}
        // The server names requirements (`a|b`); Rejected passes the kinds it turned down.
        highlighted={
          (!doc || doc.status === 'rejected') &&
          s.highlight.some(h => h === slot.requirement || (slot.kinds as string[]).includes(h))
        }
        onPick={pick}
        onRetry={() => {
          const retry = retryUploadFor(slot.key);
          if (!retry) return pick();
          void dispatch(uploadDocumentAsync(retry)).then(r => {
            if (uploadDocumentAsync.fulfilled.match(r)) haptics.success();
            else haptics.warning();
          });
        }}
        onRemove={doc ? () => dispatch(removeDocumentAsync(doc.id)) : undefined}
        onView={doc ? () => view(doc) : undefined}
      />
    );
  };

  // ── Step 2 field renderer ──
  const detailField = (field: DetailFieldSpec) =>
    field.kind === 'picker' ? (
      <PickerField
        key={field.key}
        label={field.label}
        valueLabel={s.form.details[field.key] || null}
        placeholder={field.placeholder}
        onPress={() => dispatch(openPicker(field.key))}
        error={shown[field.key]}
      />
    ) : (
      <TextField
        key={field.key}
        label={field.label}
        mode={field.kind === 'number' ? 'numeric' : 'text'}
        value={s.form.details[field.key] ?? ''}
        onChangeText={value => dispatch(setDetail({ key: field.key, value }))}
        onBlur={() => dispatch(touch(field.key))}
        error={shown[field.key]}
        helper={field.helper}
        placeholder={field.placeholder}
        multiline={field.kind === 'multiline'}
        autoCapitalize={field.key === 'pmdcNumber' ? 'characters' : 'sentences'}
      />
    );

  const pickerSpec = s.picker && s.picker !== 'city' ? allDetailFields(subType).find(d => d.key === s.picker) ?? null : null;

  return (
    <ServiceScope service={serviceType}>
      <AuthScreen onBack={back}>
        <AuthHeader
          title="Complete Your Profile"
          badge={<ProviderBadge label={providerTypeLabel(subType)} service={serviceType} />}
          subtitle={`Step ${s.step} of 3`}
        />
        <StepProgress current={s.step} total={3} />
        {business?.status === 'rejected' && business.rejectionReason ? (
          <InlineNotice tone="warning" title="Changes requested" message={business.rejectionReason} />
        ) : null}
        {s.error.message ? (
          <InlineNotice
            message={
              s.error.code === ERROR_CODES.DOCUMENTS_MISSING && s.highlight.length
                ? `Add ${s.highlight.map(requirementLabel).join(', ')} to submit.`
                : s.error.message
            }
            action={{ label: 'Dismiss', onPress: () => dispatch(dismissError()) }}
          />
        ) : null}

        <StepHeading title={STEP_COPY[s.step].title} subtitle={STEP_COPY[s.step].subtitle} />

        {s.step === 1 ? (
          <View style={styles.body}>
            <TextField
              label="Full Name"
              icon="person-outline"
              value={s.fullName}
              onChangeText={v => dispatch(setBasic({ field: 'fullName', value: v }))}
              onBlur={() => dispatch(touch('fullName'))}
              error={shown.fullName}
              placeholder="Enter your full name"
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              submitBehavior="submit"
            />
            <TextField label="Email" mode="email" icon="mail-outline" value={user.email} onChangeText={() => undefined} editable={false} helper="Your sign-in email. It can't be changed here." />
            <TextField
              ref={phoneRef}
              label="Phone Number"
              mode="phone"
              icon="call-outline"
              value={s.phone}
              onChangeText={v => dispatch(setBasic({ field: 'phone', value: v }))}
              onBlur={() => dispatch(touch('phone'))}
              error={shown.phone}
              placeholder="300 1234567"
              helper="Customers reach you on this number."
              returnKeyType="go"
              onSubmitEditing={() => void next()}
            />
          </View>
        ) : null}

        {s.step === 2 ? (
          <View style={styles.body}>
            {schema.lead.map(detailField)}
            <TextField
              label={schema.nameLabel}
              icon="briefcase-outline"
              value={s.form.name}
              onChangeText={value => dispatch(setCoreField({ field: 'name', value }))}
              onBlur={() => dispatch(touch('name'))}
              error={shown.name}
              placeholder={schema.namePlaceholder}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => addressRef.current?.focus()}
              submitBehavior="submit"
            />
            <PickerField
              label="City"
              valueLabel={s.form.city || null}
              placeholder="Select city"
              onPress={() => dispatch(openPicker('city'))}
              error={shown.city}
            />
            <TextField
              ref={addressRef}
              label={schema.addressLabel}
              icon="location-outline"
              value={s.form.address}
              onChangeText={value => dispatch(setCoreField({ field: 'address', value }))}
              onBlur={() => dispatch(touch('address'))}
              error={shown.address}
              helper={schema.addressHelper}
              placeholder="Street, block and area"
            />
            {schema.details.map(detailField)}

            <BottomSheetPicker
              visible={s.picker === 'city'}
              onClose={() => dispatch(openPicker(null))}
              title="Select City"
              options={CITIES}
              value={s.form.city || null}
              onSelect={value => {
                dispatch(setCoreField({ field: 'city', value }));
                dispatch(touch('city'));
                dispatch(openPicker(null));
              }}
            />
            <BottomSheetPicker
              visible={!!pickerSpec}
              onClose={() => dispatch(openPicker(null))}
              title={pickerSpec ? `Select ${pickerSpec.label}` : ''}
              options={pickerSpec?.options ?? []}
              value={pickerSpec ? s.form.details[pickerSpec.key] ?? null : null}
              onSelect={value => {
                if (!pickerSpec) return;
                dispatch(setDetail({ key: pickerSpec.key, value }));
                dispatch(touch(pickerSpec.key));
                dispatch(openPicker(null));
              }}
            />
          </View>
        ) : null}

        {s.step === 3 ? (
          <View style={styles.body}>
            <AppText variant="small" tone="muted">
              {filledSlots} of {slots.length} added · clear photos or PDFs, every corner visible
            </AppText>
            {slots.map(tileFor)}
          </View>
        ) : null}

        <StepButtons onBack={back} onNext={() => void next()} nextLabel={nextLabel} disabled={!stepFilled || busy || submitting} loading={busy || submitting} />
        <View style={styles.center}>
          <Button label={signingOut ? 'Signing out...' : 'Save and sign out'} variant="ghost" size="sm" onPress={() => void signOutNow()} />
        </View>

        <Sheet
          visible={!!s.pickingFor}
          onClose={() => dispatch(openDocumentPicker(null))}
          title={s.pickingFor ? DOCUMENT_LABELS[s.pickingFor.kind].label : ''}
          subtitle="Use good light and keep the whole document in frame.">
          {s.pickingFor && s.pickingFor.kinds.length > 1
            ? s.pickingFor.kinds.map(kind => (
                <ListRow
                  key={kind}
                  title={`This is my ${DOCUMENT_LABELS[kind].label}`}
                  leftIcon={s.pickingFor?.kind === kind ? 'radio-button-on' : 'radio-button-off'}
                  onPress={() => dispatch(choosePickingKind(kind))}
                />
              ))
            : null}
          {Platform.OS !== 'web' ? <ListRow title="Take a photo" leftIcon="camera-outline" onPress={async () => upload(await takePhoto())} /> : null}
          <ListRow title="Choose from photos" leftIcon="images-outline" onPress={async () => upload(await pickImageFromLibrary())} />
          <ListRow title="Choose a file" subtitle="PDF or image" leftIcon="document-text-outline" onPress={async () => upload(await pickDocumentFile())} />
        </Sheet>
        <ImageViewer visible={!!s.viewer} uri={s.viewer?.uri ?? null} title={s.viewer?.title} onClose={() => dispatch(openViewer(null))} />
      </AuthScreen>
    </ServiceScope>
  );
};

export default PersonalInfoScreen;
