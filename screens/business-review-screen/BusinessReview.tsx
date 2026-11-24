// ═══════════════════════════════════════════════════════
// MetroMatrix — Review partner application
// ═══════════════════════════════════════════════════════
// Profile, owner, documents (full-screen viewer with zoom; PDFs open in the
// system viewer), then the decision for the business's current status:
//   pending_approval → Approve · Reject (reason + per-document notes)
//   approved         → Suspend (reason)
//   suspended        → Reinstate (reason)
// A doctor is approved only after staff check the PMDC number (Health →
// Doctor verification); until then Approve is held and the notice links there.

import React, { useCallback, useEffect } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import dayjs from 'dayjs';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import {
  DOCUMENT_LABELS,
  SERVICE_LABELS,
  SUBTYPE_LABELS,
  requirementLabel,
  validateDecisionReason,
} from '../../models/businessModel';
import { hasErrors } from '../../models/authModel';
import { formatPkPhoneForDisplay } from '../../utils/phone/phone';
import { Alert } from '../../utils/alert/alert';
import { haptics } from '../../utils/haptics/haptics';
import { pdfPage } from '../../utils/cdn/cdn';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import {
  AppText,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  ImageViewer,
  InlineNotice,
  ListRow,
  ScreenShell,
  Sheet,
  SkeletonLines,
  Skeleton,
  StatusPill,
  TextAction,
  TextField,
  type PillTone,
} from '../../Custom-Components/index';
import type { AdminStackParamList, BusinessDocument, BusinessStatus } from '../../models';
import {
  decideAsync,
  loadBusinessAsync,
  openSheet,
  openViewer,
  resetReview,
  reviewDocumentAsync,
  selectBusinessReview,
  setDocumentNote,
  setReason,
  touchReason,
  type Decision,
} from './businessReviewSlice';

type Props = NativeStackScreenProps<AdminStackParamList, 'BusinessReview'>;

const STATUS: Record<BusinessStatus, { label: string; tone: PillTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_approval: { label: 'Pending', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  suspended: { label: 'Suspended', tone: 'danger' },
};

const DONE: Record<Decision, string> = {
  approve: 'Approved. The partner can start now.',
  reject: 'Rejected. The partner sees your notes.',
  suspend: 'Suspended. The partner is signed out of their tools.',
  reinstate: 'Reinstated. The business is live again.',
};

/** A PDF page's width in the viewer (points; the device's pixel ratio is applied). */
const VIEWER_WIDTH = 900;
const isPdf = (doc: BusinessDocument) => doc.mimeType === 'application/pdf' || doc.url.toLowerCase().endsWith('.pdf');

/** A document's review state, in the words staff read. */
const DOC_STATUS = {
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  pending: { label: 'Not reviewed', tone: 'neutral' },
} as const;

const makeStyles = ({ space, size, radius, colors }: Theme) =>
  StyleSheet.create({
    docRight: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    thumb: {
      width: size.thumb,
      height: size.thumb,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceSunk,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    meta: { gap: space.s4 },
  });

const BusinessReview: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size } = useTheme();
  const s = useAppSelector(selectBusinessReview);
  const id = route.params.id;

  useEffect(
    () => () => {
      dispatch(resetReview());
    },
    [id, dispatch],
  );
  // Reload on focus: the PMDC check happens on the Health tab.
  useFocusEffect(
    useCallback(() => {
      dispatch(loadBusinessAsync(id));
    }, [id, dispatch]),
  );

  const b = s.business;
  const reasonErrors = validateDecisionReason(s.reason);
  const reasonError = s.reasonTouched ? reasonErrors.reason : undefined;

  const decide = async (decision: Decision) => {
    if (decision !== 'approve' && hasErrors(reasonErrors)) {
      dispatch(touchReason());
      return;
    }
    const r = await dispatch(
      decideAsync({ id, decision, reason: s.reason, documentNotes: s.documentNotes }),
    );
    if (decideAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: b?.name ?? 'Done', text2: DONE[decision] });
      if (decision === 'approve' || decision === 'reject') navigation.goBack();
    } else haptics.warning();
  };

  // Accept one document (or undo it): the API answers the whole application again.
  const review = async (doc: BusinessDocument) => {
    if (!b) return;
    const r = await dispatch(
      reviewDocumentAsync({ id: b.id, documentId: doc.id, status: doc.status === 'accepted' ? 'pending' : 'accepted' }),
    );
    if (reviewDocumentAsync.fulfilled.match(r)) haptics.success();
    else if (!r.meta.condition) haptics.warning();
  };

  const unreviewed = b?.documents.filter(d => d.status === 'pending').length ?? 0;
  const confirmApprove = () =>
    Alert.alert(
      'Approve this business?',
      `${b?.name ?? 'It'} goes live and the partner can start.${
        unreviewed ? ` ${unreviewed === 1 ? "The document you haven't reviewed is" : `The ${unreviewed} documents you haven't reviewed are`} accepted with it.` : ''
      }`,
      [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => void decide('approve') },
    ]);

  // A PDF opens as its pages (Cloudinary won't deliver the file itself on this plan).
  const view = (doc: BusinessDocument) => {
    const title = DOCUMENT_LABELS[doc.kind].label;
    if (!isPdf(doc)) dispatch(openViewer({ uri: doc.url, title }));
    else if (pdfPage(doc.url, 1, { w: VIEWER_WIDTH })) dispatch(openViewer({ uri: doc.url, title, pdf: true }));
    else void Linking.openURL(doc.url);
  };

  if (!b) {
    return (
      <ScreenShell title={route.params.name ?? 'Application'} onBack={() => navigation.goBack()}>
        {s.loadStatus === 'failed' ? (
          <EmptyState
            icon="alert-circle"
            title="Couldn't load it"
            body={s.error.message}
            action={{ label: 'Try again', onPress: () => dispatch(loadBusinessAsync(id)) }}
          />
        ) : (
          <>
            <Skeleton height={size.qr} shape="lg" />
            <SkeletonLines lines={4} />
          </>
        )}
      </ScreenShell>
    );
  }

  const pmdcHeld = b.subType === 'doctor' && b.pmdcVerified !== true;
  const checkPmdc = () =>
    navigation.getParent()?.navigate('HealthAdminTab', { screen: 'DoctorVerification', params: { businessId: b.id }, initial: false });
  const footer =
    b.status === 'pending_approval' ? (
      <>
        <Button label="Approve" onPress={confirmApprove} loading={s.deciding === 'approve'} disabled={pmdcHeld || !!s.deciding} fullWidth size="lg" />
        <Button
          label="Reject"
          variant="secondary"
          onPress={() => dispatch(openSheet('reject'))}
          disabled={!!s.deciding}
          fullWidth
        />
      </>
    ) : b.status === 'approved' ? (
      <Button label="Suspend business" variant="destructive" onPress={() => dispatch(openSheet('suspend'))} fullWidth />
    ) : b.status === 'suspended' ? (
      <Button label="Reinstate" onPress={() => dispatch(openSheet('reinstate'))} fullWidth size="lg" />
    ) : undefined;

  return (
    <ServiceScope service={b.serviceType}>
      <ScreenShell
        eyebrow={`${SERVICE_LABELS[b.serviceType].title} · ${SUBTYPE_LABELS[b.subType].title}`}
        title="Review application"
        onBack={() => navigation.goBack()}
        footer={footer}>
        {s.error.message && !s.sheet ? <InlineNotice message={s.error.message} /> : null}

        <Card>
          <StatusPill label={STATUS[b.status].label} tone={STATUS[b.status].tone} />
          <AppText variant="display">{b.name}</AppText>
          <View style={styles.meta}>
            <AppText variant="body">{[b.address, b.city].filter(Boolean).join(', ')}</AppText>
            <AppText variant="body">{formatPkPhoneForDisplay(b.phone)}</AppText>
            {b.location ? (
              <AppText variant="small" tone="muted">
                Pin {b.location.lat.toFixed(4)}, {b.location.lng.toFixed(4)}
              </AppText>
            ) : null}
            {b.pmdcNumber ? (
              <AppText variant="small" tone="muted">
                PMDC number: {b.pmdcNumber}
              </AppText>
            ) : null}
            {b.submittedAt ? (
              <AppText variant="small" tone="muted">
                Submitted {dayjs(b.submittedAt).format('D MMM YYYY, h:mm a')}
              </AppText>
            ) : null}
          </View>
          {b.rejectionReason && b.status === 'rejected' ? (
            <InlineNotice tone="error" title="Rejection reason" message={b.rejectionReason} />
          ) : null}
          {b.suspensionReason && b.status === 'suspended' ? (
            <InlineNotice tone="warning" title="Suspension reason" message={b.suspensionReason} />
          ) : null}
          {b.subType === 'doctor' && b.status === 'pending_approval' ? (
            pmdcHeld ? (
              <InlineNotice
                tone="warning"
                title="PMDC number not checked yet"
                message="Check the registration on the PMDC register before approving this doctor."
                action={{ label: 'Check PMDC', onPress: checkPmdc }}
              />
            ) : (
              <InlineNotice tone="success" message="PMDC registration checked." />
            )
          ) : null}
        </Card>

        <Card padded="horizontal">
          <ListRow
            title={b.owner.name || 'Owner'}
            subtitle={[b.owner.email, b.owner.phone ? formatPkPhoneForDisplay(b.owner.phone) : null]
              .filter(Boolean)
              .join(' · ')}
            leftIcon="person-outline"
            onPress={b.owner.email ? () => void Linking.openURL(`mailto:${b.owner.email}`) : undefined}
            accessibilityHint="Email the owner"
          />
        </Card>

        <AppText variant="micro" tone="muted">
          Documents ({b.requiredDocuments.filter(r => r.satisfied).length} of {b.requiredDocuments.length} requirements met)
        </AppText>
        <Card padded="horizontal">
          {b.documents.length === 0 ? (
            <ListRow title="No documents uploaded" chevron={false} />
          ) : (
            b.documents.map((doc, i) => (
              <React.Fragment key={doc.id || doc.kind}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={DOCUMENT_LABELS[doc.kind].label}
                  subtitle={doc.reviewerNote ?? (isPdf(doc) ? 'PDF' : 'Image')}
                  left={
                    <View style={styles.thumb}>
                      {isPdf(doc) && !pdfPage(doc.url, 1, { w: size.thumb }) ? (
                        <Icon name="file-text" size="lg" />
                      ) : (
                        <Image
                          source={{ uri: isPdf(doc) ? pdfPage(doc.url, 1, { w: size.thumb })! : doc.url }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                        />
                      )}
                    </View>
                  }
                  right={
                    <View style={styles.docRight}>
                      <StatusPill label={DOC_STATUS[doc.status].label} tone={DOC_STATUS[doc.status].tone} />
                      {b.canReviewDocuments && doc.status !== 'rejected' ? (
                        <TextAction
                          label={doc.status === 'accepted' ? 'Undo' : 'Accept'}
                          onPress={() => void review(doc)}
                          disabled={!!s.reviewing}
                          accessibilityLabel={`${doc.status === 'accepted' ? 'Undo accepting' : 'Accept'} ${DOCUMENT_LABELS[doc.kind].label}`}
                        />
                      ) : null}
                    </View>
                  }
                  onPress={() => view(doc)}
                  accessibilityHint="Opens the document"
                />
              </React.Fragment>
            ))
          )}
        </Card>
        {b.missingDocuments.length ? (
          <InlineNotice
            tone="warning"
            message={`Missing: ${b.missingDocuments.map(requirementLabel).join(', ')}.`}
          />
        ) : null}

        <Sheet
          visible={s.sheet === 'reject'}
          onClose={() => dispatch(openSheet(null))}
          title="Reject application"
          subtitle="The partner sees your reason and notes, fixes them, and resubmits."
          footer={
            <Button
              label="Reject application"
              variant="destructive"
              onPress={() => decide('reject')}
              loading={s.deciding === 'reject'}
              fullWidth
            />
          }>
          {s.error.message ? <InlineNotice message={s.error.message} /> : null}
          <TextField
            label="Reason"
            value={s.reason}
            onChangeText={v => dispatch(setReason(v))}
            onBlur={() => dispatch(touchReason())}
            error={reasonError}
            placeholder="The PMDC certificate has expired."
            multiline
          />
          {b.documents.map(doc => (
            <TextField
              key={doc.id || doc.kind}
              label={`Note on ${DOCUMENT_LABELS[doc.kind].label} (optional)`}
              value={s.documentNotes[doc.id] ?? ''}
              onChangeText={note => dispatch(setDocumentNote({ id: doc.id, note }))}
              placeholder="What to fix"
              maxLength={500}
            />
          ))}
        </Sheet>

        <Sheet
          visible={s.sheet === 'suspend'}
          onClose={() => dispatch(openSheet(null))}
          title="Suspend business"
          subtitle="The business is hidden from customers and the partner's next request is refused."
          footer={
            <Button
              label="Suspend business"
              variant="destructive"
              onPress={() => decide('suspend')}
              loading={s.deciding === 'suspend'}
              fullWidth
            />
          }>
          {s.error.message ? <InlineNotice message={s.error.message} /> : null}
          <TextField
            label="Reason"
            value={s.reason}
            onChangeText={v => dispatch(setReason(v))}
            onBlur={() => dispatch(touchReason())}
            error={reasonError}
            placeholder="Repeated customer complaints about expired stock."
            multiline
          />
        </Sheet>

        <Sheet
          visible={s.sheet === 'reinstate'}
          onClose={() => dispatch(openSheet(null))}
          title="Reinstate business"
          subtitle="The business is live again and the partner is told by email."
          footer={
            <Button label="Reinstate" onPress={() => decide('reinstate')} loading={s.deciding === 'reinstate'} fullWidth />
          }>
          {s.error.message ? <InlineNotice message={s.error.message} /> : null}
          <TextField
            label="Reason"
            value={s.reason}
            onChangeText={v => dispatch(setReason(v))}
            onBlur={() => dispatch(touchReason())}
            error={reasonError}
            placeholder="The partner renewed their licence."
            multiline
          />
        </Sheet>

        <ImageViewer
          visible={!!s.viewer}
          uri={s.viewer?.uri ?? null}
          title={s.viewer?.title}
          pageUrl={s.viewer?.pdf ? page => pdfPage(s.viewer?.uri, page, { w: VIEWER_WIDTH }) : null}
          onClose={() => dispatch(openViewer(null))}
        />
      </ScreenShell>
    </ServiceScope>
  );
};

export default BusinessReview;
