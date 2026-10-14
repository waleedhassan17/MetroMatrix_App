// ═══════════════════════════════════════════════════════
// MetroMatrix — Verification documents
// ═══════════════════════════════════════════════════════
// One tile per document the sub-type requires (businessModel), each with
// camera / photo / file, direct Cloudinary upload with progress, retry, and
// the reviewer's note after a rejection. `highlight` (from a failed submit)
// outlines the tiles the server said are missing (QA 17).

import React from 'react';
import { Linking, Platform } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { DOCUMENT_LABELS, REQUIRED_DOCUMENTS, missingDocuments } from '@models/businessModel';
import { pickDocumentFile, pickImageFromLibrary, takePhoto } from '@utils/pickers';
import { haptics } from '@utils/haptics';
import { ServiceScope } from '@theme/index';
import {
  AppText,
  Button,
  DocumentUploadTile,
  ImageViewer,
  InlineNotice,
  ListRow,
  ScreenShell,
  Sheet,
  type DocumentTileState,
} from '@custom/index';
import type { BusinessDocument, DocumentKind, LocalFile, RootStackParamList } from '@/types';
import { selectBusiness } from '../../Auth/authSlice';
import {
  dismissError,
  openPicker,
  openViewer,
  removeDocumentAsync,
  retryFileFor,
  selectDocuments,
  uploadDocumentAsync,
} from './documentsSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'Documents'>;

const isPdf = (doc: Pick<BusinessDocument, 'mimeType' | 'url'>) =>
  doc.mimeType === 'application/pdf' || doc.url.toLowerCase().endsWith('.pdf');

const DocumentsScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const business = useAppSelector(selectBusiness);
  const s = useAppSelector(selectDocuments);
  const highlight = route.params?.highlight ?? [];

  if (!business) return null;
  const required = REQUIRED_DOCUMENTS[business.subType];
  const missing = missingDocuments(business.subType, business.documents);
  const byKind = new Map(business.documents.map(d => [d.kind, d]));

  const upload = async (kind: DocumentKind, file: LocalFile | null) => {
    dispatch(openPicker(null));
    if (!file) return;
    const r = await dispatch(uploadDocumentAsync({ kind, file }));
    if (uploadDocumentAsync.fulfilled.match(r)) haptics.success();
    else haptics.warning();
  };

  const view = (doc: BusinessDocument) => {
    if (isPdf(doc)) void Linking.openURL(doc.url);
    else dispatch(openViewer({ uri: doc.url, title: DOCUMENT_LABELS[doc.kind].label }));
  };

  const tileFor = (kind: DocumentKind) => {
    const pending = s.uploads[kind];
    const doc = byKind.get(kind);
    const state: DocumentTileState = pending
      ? 'uploading'
      : doc
        ? doc.status === 'rejected'
          ? 'rejected'
          : 'uploaded'
        : 'empty';
    return (
      <DocumentUploadTile
        key={kind}
        label={DOCUMENT_LABELS[kind].label}
        hint={DOCUMENT_LABELS[kind].hint}
        state={state}
        progress={pending?.progress}
        error={pending?.error}
        thumbnailUri={pending ? pending.previewUri : doc && !isPdf(doc) ? doc.url : null}
        isPdf={pending ? pending.isPdf : doc ? isPdf(doc) : false}
        note={doc?.reviewerNote}
        highlighted={!doc && highlight.includes(kind)}
        onPick={() => dispatch(openPicker(kind))}
        onRetry={() => {
          const file = retryFileFor(kind);
          if (file) void upload(kind, file);
          else dispatch(openPicker(kind));
        }}
        onRemove={doc && s.removingId !== doc.id ? () => dispatch(removeDocumentAsync(doc.id)) : undefined}
        onView={doc ? () => view(doc) : undefined}
      />
    );
  };
  const uploading = Object.values(s.uploads).some(u => u?.status === 'uploading');

  return (
    <ServiceScope service={business.serviceType}>
      <ScreenShell
        eyebrow="Step 3 of 3"
        title="Verification documents"
        subtitle="We check these once. Clear photos or PDFs, every corner visible."
        onBack={navigation.canGoBack() ? () => navigation.goBack() : () => navigation.navigate('BusinessProfile')}
        footer={
          <Button
            label="Review and submit"
            onPress={() => navigation.navigate('ReviewSubmit')}
            disabled={uploading}
            fullWidth
            size="lg"
          />
        }>
        {highlight.length && missing.length ? (
          <InlineNotice
            tone="error"
            title="Some documents are missing"
            message={`Add ${missing.map(k => DOCUMENT_LABELS[k].label).join(', ')} to submit.`}
          />
        ) : null}
        {s.error.message ? (
          <InlineNotice
            message={s.error.message}
            action={{ label: 'Dismiss', onPress: () => dispatch(dismissError()) }}
          />
        ) : null}
        <AppText variant="small" tone="muted">
          {required.length - missing.length} of {required.length} added
        </AppText>
        {required.map(tileFor)}

        <Sheet
          visible={!!s.pickingFor}
          onClose={() => dispatch(openPicker(null))}
          title={s.pickingFor ? DOCUMENT_LABELS[s.pickingFor].label : ''}
          subtitle="Use good light and keep the whole document in frame.">
          {Platform.OS !== 'web' ? (
            <ListRow
              title="Take a photo"
              leftIcon="camera"
              onPress={async () => s.pickingFor && upload(s.pickingFor, await takePhoto())}
            />
          ) : null}
          <ListRow
            title="Choose from photos"
            leftIcon="image"
            onPress={async () => s.pickingFor && upload(s.pickingFor, await pickImageFromLibrary())}
          />
          <ListRow
            title="Choose a file"
            subtitle="PDF or image"
            leftIcon="file"
            onPress={async () => s.pickingFor && upload(s.pickingFor, await pickDocumentFile())}
          />
        </Sheet>

        <ImageViewer
          visible={!!s.viewer}
          uri={s.viewer?.uri ?? null}
          title={s.viewer?.title}
          onClose={() => dispatch(openViewer(null))}
        />
      </ScreenShell>
    </ServiceScope>
  );
};

export default DocumentsScreen;
