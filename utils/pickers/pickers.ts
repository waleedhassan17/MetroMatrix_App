// ═══════════════════════════════════════════════════════
// MetroMatrix — Device pickers → LocalFile
// ═══════════════════════════════════════════════════════
// Camera, photo library and document picker, normalised to one LocalFile
// shape the media network uploads. Returns null when the user cancels or
// refuses permission; `onDenied` lets a caller say so (and offer Settings).
//
// Photos taken on a phone are often 4000 px and several MB. On native they
// are scaled to at most PHOTO_MAX_EDGE on the long side (JPEG 0.8) before
// upload, so a CNIC or kitchen photo goes up in seconds on a weak link and
// stays well under the 10 MB limit, with every corner still legible.

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import type { LocalFile } from '../../models/auth';

/** The long edge a photo is scaled down to before upload. */
export const PHOTO_MAX_EDGE = 2048;

export interface PickerOptions {
  /** Called when the person refused (or earlier refused) the permission. */
  onDenied?: (what: 'camera' | 'photos') => void;
}

const fromImageAsset = (asset: ImagePicker.ImagePickerAsset, fallbackName: string): LocalFile => ({
  uri: asset.uri,
  name: asset.fileName ?? fallbackName,
  mimeType: asset.mimeType ?? 'image/jpeg',
  file: (asset as unknown as { file?: Blob }).file,
  size: typeof asset.fileSize === 'number' ? asset.fileSize : undefined,
});

/** A photo, scaled to PHOTO_MAX_EDGE on native when it's bigger; untouched otherwise (and on web). */
const sizedPhoto = async (asset: ImagePicker.ImagePickerAsset, fallbackName: string): Promise<LocalFile> => {
  const original = fromImageAsset(asset, fallbackName);
  const longEdge = Math.max(asset.width ?? 0, asset.height ?? 0);
  if (Platform.OS === 'web' || asset.type === 'video' || longEdge <= PHOTO_MAX_EDGE) return original;
  try {
    const resize = (asset.width ?? 0) >= (asset.height ?? 0) ? { width: PHOTO_MAX_EDGE } : { height: PHOTO_MAX_EDGE };
    const out = await ImageManipulator.manipulateAsync(asset.uri, [{ resize }], {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const name = original.name.replace(/\.[^.]+$/, '') || `photo_${Date.now()}`;
    return { uri: out.uri, name: `${name}.jpg`, mimeType: 'image/jpeg' };
  } catch {
    return original;
  }
};

export const pickImageFromLibrary = async (options: { square?: boolean } & PickerOptions = {}): Promise<LocalFile | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    options.onDenied?.('photos');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: !!options.square,
    aspect: options.square ? [1, 1] : undefined,
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return sizedPhoto(result.assets[0], `photo_${Date.now()}.jpg`);
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

export const takePhoto = async (options: PickerOptions = {}): Promise<LocalFile | null> => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    options.onDenied?.('camera');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled || !result.assets?.[0]) return null;
  return sizedPhoto(result.assets[0], `camera_${Date.now()}.jpg`);
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
    size: typeof asset.size === 'number' ? asset.size : undefined,
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
  return Promise.all((result.assets ?? []).slice(0, max).map((a, i) => sizedPhoto(a, `page_${Date.now()}_${i + 1}.jpg`)));
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
    size: typeof a.size === 'number' ? a.size : undefined,
  }));
};
