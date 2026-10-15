// ═══════════════════════════════════════════════════════
// DocumentUploadTile — one required document, four states
// ═══════════════════════════════════════════════════════
//   empty      → "Add" (camera or file chosen by the caller's picker)
//   uploading  → progress bar; a failed upload offers Retry
//   uploaded   → thumbnail (or a file glyph for PDFs), view and remove
//   rejected   → the reviewer's note, and "Replace"
// `highlighted` marks a tile the server reported missing on submit.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useStyles, useTheme, type Theme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';
import { ProgressBar } from './ProgressBar';
import { StatusPill } from './StatusPill';

export type DocumentTileState = 'empty' | 'uploading' | 'uploaded' | 'rejected';

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
  onPick: () => void;
  onRetry?: () => void;
  onRemove?: () => void;
  onView?: () => void;
}

const makeStyles = ({ colors, radius, space, size, elevation }: Theme) =>
  StyleSheet.create({
    root: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: space.s16,
      gap: space.s12,
      ...elevation.none,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    thumb: {
      width: size.thumb,
      height: size.thumb,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceSunk,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    title: { flex: 1, gap: space.s4 },
    actions: { flexDirection: 'row', gap: space.s8, flexWrap: 'wrap' },
    note: {
      flexDirection: 'row',
      gap: space.s8,
      backgroundColor: colors.dangerSoft,
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
  onPick,
  onRetry,
  onRemove,
  onView,
}) => {
  const styles = useStyles(makeStyles);
  const { colors, service, size } = useTheme();

  const pill =
    state === 'uploaded' ? (
      <StatusPill label="Uploaded" tone="success" />
    ) : state === 'rejected' ? (
      <StatusPill label="Needs a new copy" tone="danger" />
    ) : highlighted ? (
      <StatusPill label="Required" tone="danger" />
    ) : null;

  return (
    <View
      style={[
        styles.root,
        highlighted && { borderColor: colors.danger, borderWidth: size.focusBorder },
      ]}
      accessible={false}>
      <View style={styles.head}>
        <Pressable
          onPress={onView}
          disabled={!onView || state !== 'uploaded'}
          accessibilityRole={onView && state === 'uploaded' ? 'imagebutton' : undefined}
          accessibilityLabel={`View ${label}`}
          style={styles.thumb}>
          {thumbnailUri && !isPdf ? (
            <Image
              source={{ uri: thumbnailUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <Icon
              name={isPdf ? 'file-text' : state === 'empty' ? 'upload' : 'image'}
              size="lg"
              color={service.accent}
            />
          )}
        </Pressable>
        <View style={styles.title}>
          <AppText variant="title">{label}</AppText>
          {hint ? (
            <AppText variant="small" tone="muted">
              {hint}
            </AppText>
          ) : null}
          {pill}
        </View>
      </View>

      {state === 'uploading' ? (
        <ProgressBar progress={progress} accessibilityLabel={`Uploading ${label}`} />
      ) : null}

      {error ? (
        <AppText variant="small" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}

      {state === 'rejected' && note ? (
        <View style={styles.note}>
          <Icon name="message-square" size="sm" color={colors.danger} />
          <AppText variant="small" tone="danger" style={{ flex: 1 }}>
            {note}
          </AppText>
        </View>
      ) : null}

      <View style={styles.actions}>
        {state === 'empty' ? (
          <Button
            label="Add document"
            size="sm"
            variant="secondary"
            leftIcon="add"
            onPress={onPick}
          />
        ) : null}
        {state === 'uploading' && error && onRetry ? (
          <Button
            label="Retry"
            size="sm"
            variant="secondary"
            leftIcon="refresh"
            onPress={onRetry}
          />
        ) : null}
        {state === 'uploaded' ? (
          <>
            {onView ? <Button label="View" size="sm" variant="ghost" onPress={onView} /> : null}
            <Button label="Replace" size="sm" variant="ghost" onPress={onPick} />
            {onRemove ? (
              <Button
                label="Remove"
                size="sm"
                variant="ghost"
                onPress={onRemove}
                accessibilityLabel={`Remove ${label}`}
              />
            ) : null}
          </>
        ) : null}
        {state === 'rejected' ? (
          <Button
            label="Replace document"
            size="sm"
            variant="secondary"
            leftIcon="cloud-upload-outline"
            onPress={onPick}
          />
        ) : null}
      </View>
    </View>
  );
};

export default DocumentUploadTile;
