// "Choose a file" (the document picker) treats images like photos: a big one
// is scaled to PHOTO_MAX_EDGE as JPEG before upload, so a 12 MB phone photo
// isn't refused at the 10 MB limit; HEIC becomes JPEG; PDFs pass untouched
// (the 2026-11-25 documents QA).

import { Image } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { PHOTO_MAX_EDGE, pickDocumentFile, sizedDocument } from '../pickers/pickers';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
const manipulate = ImageManipulator.manipulateAsync as jest.Mock;
const getDocument = DocumentPicker.getDocumentAsync as jest.Mock;

const sizeIs = (width: number, height: number) =>
  jest.spyOn(Image, 'getSize').mockImplementation((_uri, ok) => ok(width, height));

beforeEach(() => jest.clearAllMocks());

describe('sizedDocument', () => {
  it('scales a big image to the long-edge limit, as JPEG', async () => {
    sizeIs(4000, 3000);
    const out = await sizedDocument({ uri: 'file:///big.png', name: 'scan.png', mimeType: 'image/png', size: 12_000_000 });
    expect(manipulate).toHaveBeenCalledWith('file:///big.png', [{ resize: { width: PHOTO_MAX_EDGE } }], expect.objectContaining({ format: 'jpeg' }));
    expect(out).toEqual({ uri: 'file:///big.png#resized', name: 'scan.jpg', mimeType: 'image/jpeg' });
  });

  it('scales a tall image by its height', async () => {
    sizeIs(3000, 4000);
    await sizedDocument({ uri: 'file:///tall.jpg', name: 'tall.jpg', mimeType: 'image/jpeg' });
    expect(manipulate).toHaveBeenCalledWith('file:///tall.jpg', [{ resize: { height: PHOTO_MAX_EDGE } }], expect.anything());
  });

  it('leaves a small JPEG as it is', async () => {
    sizeIs(1200, 900);
    const file = { uri: 'file:///small.jpg', name: 'small.jpg', mimeType: 'image/jpeg', size: 300_000 };
    expect(await sizedDocument(file)).toBe(file);
    expect(manipulate).not.toHaveBeenCalled();
  });

  it('turns a small HEIC into JPEG so reviewers can open it', async () => {
    sizeIs(1200, 900);
    const out = await sizedDocument({ uri: 'file:///a.heic', name: 'a.heic', mimeType: 'image/heic' });
    expect(manipulate).toHaveBeenCalledWith('file:///a.heic', [], expect.objectContaining({ format: 'jpeg' }));
    expect(out.mimeType).toBe('image/jpeg');
  });

  it('never touches a PDF', async () => {
    const file = { uri: 'file:///pmdc.pdf', name: 'pmdc.pdf', mimeType: 'application/pdf', size: 2_000_000 };
    expect(await sizedDocument(file)).toBe(file);
    expect(manipulate).not.toHaveBeenCalled();
  });

  it('keeps the original when the image cannot be read', async () => {
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, _ok, fail) => fail?.(new Error('x')));
    const file = { uri: 'file:///odd.jpg', name: 'odd.jpg', mimeType: 'image/jpeg' };
    expect(await sizedDocument(file)).toBe(file);
  });
});

describe('pickDocumentFile', () => {
  it('reads a missing MIME type off the name', async () => {
    getDocument.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///d.pdf', name: 'degree.pdf', size: 1000 }] });
    expect(await pickDocumentFile()).toMatchObject({ mimeType: 'application/pdf', name: 'degree.pdf' });
  });

  it('answers null when the person cancels', async () => {
    getDocument.mockResolvedValue({ canceled: true, assets: null });
    expect(await pickDocumentFile()).toBeNull();
  });
});
