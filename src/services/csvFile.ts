// ═══════════════════════════════════════════════════════
// MetroMatrix — a CSV file staff pick, read as text
// ═══════════════════════════════════════════════════════
// The document picker (CSV and plain text), then the file's text: the
// browser's File on the web, expo-file-system on a phone. The text goes to
// the server's dry run; nothing is parsed here.

import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

/** The largest file the console reads (the API takes up to 2,000 rows). */
export const MAX_CSV_BYTES = 400_000;

export interface PickedCsv {
  name: string;
  text: string;
}

export class CsvFileError extends Error {}

/** null when the person closes the picker. */
export const pickCsvFile = async (): Promise<PickedCsv | null> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > MAX_CSV_BYTES) throw new CsvFileError('That file is too large. Up to 2,000 rows at a time.');
  let text: string;
  if (Platform.OS === 'web' && asset.file) text = await asset.file.text();
  else {
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    text = await new File(asset.uri).text();
  }
  if (text.length > MAX_CSV_BYTES) throw new CsvFileError('That file is too large. Up to 2,000 rows at a time.');
  return { name: asset.name, text };
};
