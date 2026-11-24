// ═══════════════════════════════════════════════════════
// MetroMatrix — Personal Info (providers, after email verification)
// ═══════════════════════════════════════════════════════
// The FYP's provider-info screen: three steps with its progress bar + dots,
// the provider-type badge, and Back / Continue. The fields of step 2 and the
// documents of step 3 come from businessModel for the provider's sub-type.

import React, { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Linking, Platform, StyleSheet, View, type TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useSignOut } from '../../hooks/useSignOut';
import { hasErrors, validateProviderBasics } from '../../models/authModel';
import {
  BUSINESS_FORM_SCHEMA,
  CITIES,
  DOCUMENT_LABELS,
  SUBTYPE_SERVICE,
  TYPED_CITY_HINT,
  allDetailFields,
  documentSlots,
  missingDocuments,
  providerTypeLabel,
  requirementLabel,
  typedCity,
  validateBusinessProfile,
  type DetailFieldSpec,
  type DocumentSlot,
} from '../../models/businessModel';
import { visibleErrors } from '../../utils/form-errors/formErrors';
import { haptics } from '../../utils/haptics/haptics';
import { Alert } from '../../utils/alert/alert';
import { pickDocumentFile, pickImageFromLibrary, takePhoto } from '../../utils/pickers/pickers';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  BottomSheetPicker,
  Button,
  DocumentUploadTile,
  ImageViewer,
  InlineNotice,
  ListRow,
  PickerField,
  SearchPicker,
  Sheet,
  Skeleton,
  TextField,
  type DocumentTileState,
} from '../../Custom-Components/index';
import { AuthHeader, AuthScreen, ProviderBadge, ScrollToTopOnMessage } from '../../Components/auth/AuthChrome';
import { StepButtons, StepHeading, StepProgress } from '../../Components/auth/StepFlow';
import type { BusinessDocument, LocalFile, RootStackParamList } from '../../models';
import { selectBusiness, selectUser } from '../../store/authSlice';
import { selectPendingPick } from '../provider-selection-screen/providerSelectionSlice';
import {
  dismissError,
  discardUpload,
  forgetUpload,
  goToStep,
  initialise,
  nextCreateKey,
  nextSubmitKey,
  setPermissionDenied,
  choosePickingKind,
  openDocumentPicker,
  openPicker,
  openViewer,
  refreshBusinessAsync,
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
import { ERROR_CODES } from '../../networks/network/network';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalInfo'>;

const STEP_COPY = {
  1: { title: 'Personal Information', subtitle: 'Tell us about yourself' },
  2: { title: 'Professional Details', subtitle: 'Your expertise and credentials' },
  3: { title: 'Upload Documents', subtitle: 'Clear photos or PDFs' },
} as const;
/** Step 3's line under its title, with the count first. */
const documentsLine = (added: number, total: number) => `${added} of ${total} added · clear photos or PDFs`;

/** How many skeleton tiles stand in while the documents are read. */
const SKELETON_TILES = 3;

const isPdf = (doc: Pick<BusinessDocument, 'mimeType' | 'url'>) =>
  doc.mimeType === 'application/pdf' || doc.url.toLowerCase().endsWith('.pdf');

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    body: { gap: space.s20 },
    tiles: { gap: space.s12 },
    center: { alignItems: 'center' },
  });

const PersonalInfo: React.FC<Props> = ({ route, navigation }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size, space } = useTheme();
  // A document tile's height: the 56 pt preview inside its 12 pt padding.
  const tileHeight = size.thumb + space.s24;
  const user = useAppSelector(selectUser);
  const business = useAppSelector(selectBusiness);
  const s = useAppSelector(selectPersonalInfo);
  const { signOutNow, signingOut } = useSignOut();
  const phoneRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  // A native picker is open: a second tap must not launch another one.
  const pickerOpen = useRef(false);

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

  // The full business may arrive after a short summary: fill again once it does.
  const businessDetail = business ? (business.address ? 'full' : 'summary') : 'none';
  // Only the summary (the full read at startup failed): read it now, so the
  // form and the tiles show what was already saved.
  useEffect(() => {
    if (businessDetail === 'summary') void dispatch(refreshBusinessAsync());
  }, [dispatch, businessDetail, business?.id]);
  useEffect(() => {
    if (user) dispatch(initialise({ user, business, step: paramStep, highlight: paramHighlight }));
    // Only on arrival and when the account / draft changes identity (or fills in).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, user?.id, business?.id, businessDetail, paramStep, paramHighlight]);

  // Android's back button walks the steps back; from step 1 it does what it always does.
  const saving = s.status === 'loading' || s.submitStatus === 'loading';
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (s.step > 1 && !saving) {
          dispatch(goToStep((s.step - 1) as 1 | 2));
          return true;
        }
        return s.step > 1; // saving: hold still rather than leave mid-save
      });
      return () => sub.remove();
    }, [dispatch, s.step, saving]),
  );

  if (!user || serviceUnknown) return null;

  const basicErrors = validateProviderBasics({ name: s.fullName, phone: s.phone });
  const proErrors = validateBusinessProfile(subType, s.form);
  // The server's word on a field shows whether or not it was touched, until it's edited.
  const shown = {
    ...visibleErrors(
      { ...(basicErrors.name ? { fullName: basicErrors.name } : {}), ...(basicErrors.phone ? { phone: basicErrors.phone } : {}), ...proErrors },
      s.touched,
    ),
    ...s.serverErrors,
  } as Record<string, string | undefined>;
  const busy = s.status === 'loading';
  const submitting = s.submitStatus === 'loading';
  const documents = business?.documents ?? [];
  const slots = documentSlots(subType, documents);
  // The server's list when it sent one (its rules win); the local rules otherwise.
  const missing = business?.missingDocuments ?? missingDocuments(subType, documents);
  const filledSlots = slots.filter(slot => slot.doc && slot.doc.status !== 'rejected').length;
  const uploading = Object.values(s.uploads).some(u => u?.status === 'uploading');
  // The form and tiles wait for the full business rather than show it empty.
  const readingBusiness = businessDetail === 'summary' && s.businessStatus === 'loading' && s.step > 1;
  // Back holds still while a save is on the wire: its answer would land on the wrong step.
  const back = s.step > 1 && !busy && !submitting ? () => dispatch(goToStep((s.step - 1) as 1 | 2)) : undefined;

  const signOutAsking = () =>
    Alert.alert('Sign out?', 'The steps you saved are kept. Changes on this step that you haven\'t saved are lost.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOutNow() },
    ]);
  const onDenied = (what: 'camera' | 'photos') => dispatch(setPermissionDenied(what));

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
        saveProfessionalAsync({ business, serviceType, subType, form: s.form, phone: user.phone ?? '', createKey: nextCreateKey(s) }),
      );
      if (saveProfessionalAsync.rejected.match(r)) haptics.warning();
      return;
    }
    const r = await dispatch(submitApplicationAsync({ key: nextSubmitKey(s) }));
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
    dispatch(setPermissionDenied(null));
    const r = await dispatch(uploadDocumentAsync({ slot: picking.slot, kind: picking.kind, file, replacing: picking.replacing }));
    if (uploadDocumentAsync.fulfilled.match(r)) haptics.success();
    else haptics.warning();
  };

  /** One native picker at a time; the guard lifts as soon as it returns. */
  const choose = (open: () => Promise<LocalFile | null>) => async () => {
    if (pickerOpen.current) return;
    pickerOpen.current = true;
    let file: LocalFile | null = null;
    try {
      file = await open();
    } catch {
      Alert.alert("That didn't open", 'Try again, or choose a file instead.');
    } finally {
      pickerOpen.current = false;
    }
    await upload(file);
  };

  const confirmRemove = (doc: BusinessDocument, label: string) =>
    Alert.alert(`Remove ${label}?`, 'You can add it again before you submit.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void dispatch(removeDocumentAsync(doc.id)) },
    ]);

  const view = (doc: BusinessDocument) => {
    if (isPdf(doc)) void Linking.openURL(doc.url);
    else dispatch(openViewer({ uri: doc.url, title: DOCUMENT_LABELS[doc.kind].label }));
  };

  const tileFor = (slot: DocumentSlot) => {
    const pending = s.uploads[slot.key];
    const { doc } = slot;
    const state: DocumentTileState = pending
      ? pending.status === 'failed'
        ? 'failed'
        : 'uploading'
      : doc
        ? doc.status === 'rejected'
          ? 'rejected'
          : 'uploaded'
        : 'empty';
    const pick = () => dispatch(openDocumentPicker({ slot: slot.key, kinds: slot.kinds, replacing: doc?.id ?? null }));
    const label = doc && slot.kinds.length > 1 ? `${slot.label} · ${DOCUMENT_LABELS[doc.kind].label}` : slot.label;
    return (
      <DocumentUploadTile
        key={slot.key}
        label={label}
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
        onChooseAnother={() => {
          forgetUpload(slot.key);
          dispatch(discardUpload(slot.key));
          pick();
        }}
        removing={!!doc && s.removing.includes(doc.id)}
        onRemove={doc && !s.removing.includes(doc.id) ? () => confirmRemove(doc, label) : undefined}
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
          hideLogo
          title="Complete Your Profile"
          badge={<ProviderBadge label={providerTypeLabel(subType)} service={serviceType} />}
          subtitle={`Step ${s.step} of 3`}
        />
        <StepProgress current={s.step} total={3} />
        {business?.status === 'rejected' && business.rejectionReason ? (
          <InlineNotice tone="warning" title="Changes requested" message={business.rejectionReason} />
        ) : null}
        {s.permissionDenied ? (
          <InlineNotice
            tone="warning"
            title={s.permissionDenied === 'camera' ? 'Camera access is off' : 'Photo access is off'}
            message="Allow it in Settings to add your documents, or choose a file instead."
            action={{ label: 'Open Settings', onPress: () => void Linking.openSettings() }}
          />
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

        <ScrollToTopOnMessage message={s.error.message} />

        <StepHeading
          title={STEP_COPY[s.step].title}
          subtitle={
            s.step === 3 && !readingBusiness
              ? documentsLine(filledSlots, slots.length)
              : STEP_COPY[s.step].subtitle
          }
        />

        {readingBusiness ? (
          <View style={styles.tiles} accessibilityLabel="Loading your saved details">
            {Array.from({ length: SKELETON_TILES }, (_, i) => (
              <Skeleton key={i} height={tileHeight} shape="lg" />
            ))}
          </View>
        ) : null}

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

        {s.step === 2 && !readingBusiness ? (
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

            <SearchPicker
              visible={s.picker === 'city'}
              onClose={() => dispatch(openPicker(null))}
              title="Select City"
              options={CITIES}
              value={s.form.city || null}
              searchLabel="Search or type your city"
              placeholder="e.g. Lahore"
              custom={typedCity}
              customHint={TYPED_CITY_HINT}
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

        {s.step === 3 && !readingBusiness ? <View style={styles.tiles}>{slots.map(tileFor)}</View> : null}

        <StepButtons onBack={back} onNext={() => void next()} nextLabel={nextLabel} disabled={!stepFilled || busy || submitting} loading={busy || submitting} />
        <View style={styles.center}>
          <Button label={signingOut ? 'Signing out...' : 'Sign out'} variant="ghost" size="sm" disabled={signingOut} onPress={signOutAsking} />
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
          {Platform.OS !== 'web' ? (
            <ListRow title="Take a photo" leftIcon="camera-outline" onPress={choose(() => takePhoto({ onDenied }))} />
          ) : null}
          <ListRow title="Choose from photos" leftIcon="images-outline" onPress={choose(() => pickImageFromLibrary({ onDenied }))} />
          <ListRow title="Choose a file" subtitle="PDF or image" leftIcon="document-text-outline" onPress={choose(pickDocumentFile)} />
        </Sheet>
        <ImageViewer visible={!!s.viewer} uri={s.viewer?.uri ?? null} title={s.viewer?.title} onClose={() => dispatch(openViewer(null))} />
      </AuthScreen>
    </ServiceScope>
  );
};

export default PersonalInfo;
