// ═══════════════════════════════════════════════════════
// MetroMatrix — Device pickers → LocalFile
// ═══════════════════════════════════════════════════════
// Camera, photo library and document picker, normalised to one LocalFile
// shape the media network uploads. Returns null when the user cancels or
// refuses permission (the caller decides whether to say so).

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import type { LocalFile } from '../types/auth';

const fromImageAsset = (asset: ImagePicker.ImagePickerAsset, fallbackName: string): LocalFile => ({
  uri: asset.uri,
  name: asset.fileName ?? fallbackName,
  mimeType: asset.mimeType ?? 'image/jpeg',
  file: (asset as unknown as { file?: Blob }).file,
});

export const pickImageFromLibrary = async (options: { square?: boolean } = {}): Promise<LocalFile | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: !!options.square,
    aspect: options.square ? [1, 1] : undefined,
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return fromImageAsset(result.assets[0], `photo_${Date.now()}.jpg`);
};

/** A short video (a kitchen's story): up to a minute, from the library. */
export const pickVideoFromLibrary = async (): Promise<LocalFile | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], videoMaxDuration: 60, quality: 0.7 });
  if (result.canceled || !result.assets?.[0]) return null;
  const a = result.assets[0];
  return { ...fromImageAsset(a, `video_${Date.now()}.mp4`), mimeType: a.mimeType ?? 'video/mp4' };
};

export const takePhoto = async (): Promise<LocalFile | null> => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled || !result.assets?.[0]) return null;
  return fromImageAsset(result.assets[0], `camera_${Date.now()}.jpg`);
};

export const pickDocumentFile = async (): Promise<LocalFile | null> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? 'application/octet-stream',
    file: asset.file,
  };
};

/** Several photos at once (a multi-page report), up to `max`. */
export const pickImagesFromLibrary = async (max: number): Promise<LocalFile[]> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: max,
    quality: 0.8,
  });
  if (result.canceled) return [];
  return (result.assets ?? []).slice(0, max).map((a, i) => fromImageAsset(a, `page_${Date.now()}_${i + 1}.jpg`));
};

/** Several files (PDFs or images) at once. */
export const pickDocumentFiles = async (max: number): Promise<LocalFile[]> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    copyToCacheDirectory: true,
    multiple: true,
  });
  if (result.canceled) return [];
  return (result.assets ?? []).slice(0, max).map(a => ({
    uri: a.uri,
    name: a.name,
    mimeType: a.mimeType ?? 'application/octet-stream',
    file: a.file,
  }));
};
