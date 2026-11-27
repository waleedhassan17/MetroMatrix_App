// ═══════════════════════════════════════════════════════
// DocumentUploadTile — one required document, as one compact row
// ═══════════════════════════════════════════════════════
//   empty      → the whole row is the target; "Add" sits on the trailing side
//   uploading  → the picked file's preview, "Uploading 45%" and a bar
//   failed     → what went wrong, Retry and "Choose another file"
//   uploaded   → the preview (tap to view); under the title "Uploaded" and
//                View · Replace · Remove
//   rejected   → the reviewer's note, and "Replace"
// `highlighted` marks a tile the server reported missing on submit. The
// slot's hint shows only while it is empty: once a file is in, the row says
// what happened to it instead (the 2026-11-25 declutter).

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { IonIcon } from './Icon';
import { ProgressBar } from './ProgressBar';
import { StatusPill } from './StatusPill';
import { TextAction } from './TextAction';

export type DocumentTileState = 'empty' | 'uploading' | 'failed' | 'uploaded' | 'rejected';

export interface DocumentUploadTileProps {
  label: string;
  hint?: string;
  state: DocumentTileState;
  progress?: number;
  thumbnailUri?: string | null;
  isPdf?: boolean;
  note?: string | null;
  error?: string | null;
  highlighted?: boolean;
  /** Its removal is on the wire. */
  removing?: boolean;
  onPick: () => void;
  onRetry?: () => void;
  /** A failed upload: let it go and pick a different file. */
  onChooseAnother?: () => void;
  onRemove?: () => void;
  onView?: () => void;
}

const makeStyles = ({ colors, radius, space, size, elevation }: Theme) =>
  StyleSheet.create({
    root: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: space.s12,
      gap: space.s12,
      ...elevation.none,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: size.thumb },
    thumb: {
      width: size.thumb,
      height: size.thumb,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceSunk,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    text: { flex: 1, gap: space.s4 },
    errorLine: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s4 },
    add: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      minHeight: size.control.sm,
      paddingHorizontal: space.s12,
      borderRadius: radius.pill,
    },
    // Under the title; the links' 44 pt targets would otherwise pad the row twice.
    actions: { flexDirection: 'row', alignItems: 'center', gap: space.s16, flexWrap: 'wrap', marginVertical: -space.s8 },
    buttons: { flexDirection: 'row', alignItems: 'center', gap: space.s8, flexWrap: 'wrap' },
    note: {
      flexDirection: 'row',
      gap: space.s8,
      backgroundColor: colors.surfaceSunk,
      borderRadius: radius.sm,
      padding: space.s12,
    },
  });

export const DocumentUploadTile: React.FC<DocumentUploadTileProps> = ({
  label,
  hint,
  state,
  progress = 0,
  thumbnailUri,
  isPdf,
  note,
  error,
  highlighted,
  removing,
  onPick,
  onRetry,
  onChooseAnother,
  onRemove,
  onView,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, service, size, opacity } = useTheme();
  const empty = state === 'empty';
  const canView = state === 'uploaded' && !!onView;
  const percent = Math.round(Math.min(Math.max(progress, 0), 1) * 100);

  const thumb = (
    <Pressable
      onPress={onView}
      disabled={!canView}
      accessibilityRole={canView ? 'imagebutton' : undefined}
      accessibilityLabel={canView ? `View ${label}` : undefined}
      accessibilityElementsHidden={!canView}
      importantForAccessibility={canView ? 'auto' : 'no-hide-descendants'}
      style={styles.thumb}>
      {thumbnailUri && !isPdf ? (
        <Image source={{ uri: thumbnailUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <IonIcon name={isPdf ? 'document-text-outline' : empty ? 'cloud-upload-outline' : 'image-outline'} size="lg" color={colors.inkMuted} />
      )}
    </Pressable>
  );

  const line =
    state === 'empty' ? (
      highlighted ? (
        <AppText variant="small" tone="danger">
          Required to submit
        </AppText>
      ) : hint ? (
        <AppText variant="small" tone="muted">
          {hint}
        </AppText>
      ) : null
    ) : state === 'uploading' ? (
      <AppText variant="small" tone="muted" accessibilityLiveRegion="polite">
        {percent >= 100 ? 'Saving...' : `Uploading ${percent}%`}
      </AppText>
    ) : state === 'failed' ? (
      <View style={styles.errorLine} accessibilityLiveRegion="polite">
        <IonIcon name="alert-circle" size="sm" color={colors.danger} />
        <AppText variant="small" tone="danger" style={styles.text}>
          {error ?? 'Upload failed. Try again.'}
        </AppText>
      </View>
    ) : state === 'uploaded' ? (
      removing ? (
        <AppText variant="small" tone="muted" accessibilityLiveRegion="polite">
          Removing...
        </AppText>
      ) : (
        <>
          <StatusPill label="Uploaded" tone="success" />
          <View style={styles.actions}>
            {onView ? <TextAction label="View" onPress={onView} accessibilityLabel={`View ${label}`} /> : null}
            <TextAction label="Replace" onPress={onPick} accessibilityLabel={`Replace ${label}`} />
            {onRemove ? (
              <TextAction label="Remove" tone="danger" onPress={onRemove} accessibilityLabel={`Remove ${label}`} />
            ) : null}
          </View>
        </>
      )
    ) : state === 'rejected' ? (
      <StatusPill label="Needs a new copy" tone="danger" />
    ) : null;

  const trailing =
    state === 'empty' ? (
      <View style={[styles.add, { backgroundColor: service.accentSoft }]}>
        <IonIcon name="add" size="sm" color={service.accentDeep} />
        <AppText variant="chip" tone="accentDeep">
          Add
        </AppText>
      </View>
    ) : null;

  const headBody = (
    <>
      {thumb}
      <View style={styles.text}>
        <AppText variant="title">{label}</AppText>
        {line}
      </View>
      {trailing}
    </>
  );

  return (
    <View
      style={[styles.root, highlighted && { borderColor: colors.danger, borderWidth: size.focusBorder }]}
      accessible={false}>
      {empty ? (
        // An empty slot is one big target: the whole row opens the picker.
        <Pressable
          onPress={onPick}
          accessibilityRole="button"
          accessibilityLabel={`Add ${label}`}
          accessibilityHint={highlighted ? 'Required to submit' : hint}
          style={({ pressed }) => [styles.head, pressed && { opacity: opacity.pressed }]}>
          {headBody}
        </Pressable>
      ) : (
        <View style={styles.head}>{headBody}</View>
      )}

      {state === 'uploading' ? <ProgressBar progress={progress} accessibilityLabel={`Uploading ${label}`} /> : null}

      {state === 'failed' ? (
        <View style={styles.buttons}>
          {onRetry ? (
            <Button
              label="Retry"
              size="sm"
              variant="secondary"
              leftIcon="refresh"
              onPress={onRetry}
              accessibilityLabel={`Retry ${label}`}
            />
          ) : null}
          {onChooseAnother ? <TextAction label="Choose another file" onPress={onChooseAnother} /> : null}
        </View>
      ) : null}

      {state === 'rejected' ? (
        <>
          {note ? (
            <View style={styles.note}>
              <IonIcon name="chatbox-ellipses-outline" size="sm" color={colors.danger} />
              <AppText variant="small" style={styles.text}>
                {note}
              </AppText>
            </View>
          ) : null}
          <View style={styles.buttons}>
            <Button
              label="Replace document"
              size="sm"
              variant="secondary"
              leftIcon="cloud-upload-outline"
              onPress={onPick}
              accessibilityLabel={`Replace ${label}`}
            />
          </View>
        </>
      ) : null}
    </View>
  );
};

export default DocumentUploadTile;
