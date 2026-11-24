// The Cloudinary upload's failures read like the rest of the app (the
// 2026-11-25 documents QA): a dropped connection says "offline" only when the
// device is offline, a refused file says what to send instead, and a server
// that can't sign or store uploads says uploads are unavailable — never the
// raw "Invalid Signature" or "File uploads are not configured on this server."

import {
  ApiError,
  ERROR_CODES,
  UPLOAD_UNAVAILABLE_COPY,
  cloudinaryRefusal,
  errorCopy,
  uploadFileCopy,
  uploadToCloudinary,
} from '../network';
import { signUpload } from '../../../services/mediaUpload';
import type { SignedUpload } from '../../../models/auth';

jest.mock('../../media/media', () => ({ signUpload: jest.fn() }));
const media = jest.requireMock('../../media/media') as { signUpload: jest.Mock };
const network = jest.requireMock('expo-network') as { getNetworkStateAsync: jest.Mock };

const signed: SignedUpload = {
  cloudName: 'demo',
  apiKey: 'k',
  timestamp: 1,
  signature: 's',
  folder: 'metromatrix/test/u1/business_document',
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/auto/upload',
  allowedFormats: 'jpg,jpeg,png,webp,heic,pdf',
  maxBytes: 10_000_000,
  type: null,
};
const file = { uri: 'file:///cnic.jpg', name: 'cnic.jpg', mimeType: 'image/jpeg' };

/** A stand-in XHR: each test says how the request ends. */
type Ending = { kind: 'load'; status: number; body: unknown } | { kind: 'error' } | { kind: 'timeout' };
let ending: Ending;
class FakeXhr {
  status = 0;
  responseText = '';
  timeout = 0;
  upload: { onprogress: ((e: unknown) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  open() {}
  send() {
    setTimeout(() => {
      if (ending.kind === 'load') {
        this.status = ending.status;
        this.responseText = JSON.stringify(ending.body);
        this.onload?.();
      } else if (ending.kind === 'error') this.onerror?.();
      else this.ontimeout?.();
    }, 0);
  }
}

const realXhr = global.XMLHttpRequest;
beforeAll(() => {
  (global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;
});
afterAll(() => {
  global.XMLHttpRequest = realXhr;
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

const failure = async (): Promise<ApiError> => {
  try {
    await uploadToCloudinary(file, signed);
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('the upload should have failed');
};

describe('no answer from storage', () => {
  it('a dropped connection on a phone that is online does not say offline', async () => {
    ending = { kind: 'error' };
    const e = await failure();
    expect(e.code).toBe(ERROR_CODES.NETWORK_ERROR);
    expect(e.details).toEqual({ reason: 'unreachable', upload: true });
    expect(e.message).not.toMatch(/offline/i);
    expect(errorCopy(e.code, e.details)).toBe(e.message);
  });

  it('a timeout says the upload is taking too long', async () => {
    ending = { kind: 'timeout' };
    const e = await failure();
    expect(e.details.reason).toBe('timeout');
    expect(e.message).toMatch(/taking too long/);
  });

  it('only a device that reports no connection is told it is offline', async () => {
    network.getNetworkStateAsync.mockResolvedValueOnce({ isConnected: false });
    ending = { kind: 'error' };
    const e = await failure();
    expect(e.details.reason).toBe('offline');
    expect(e.message).toMatch(/You're offline/);
  });
});

describe('Cloudinary refused it', () => {
  it('a refused file says what to send instead, with the limit', async () => {
    ending = { kind: 'load', status: 400, body: { error: { message: 'Invalid image file' } } };
    const e = await failure();
    expect(e.code).toBe(ERROR_CODES.UPLOAD_FAILED);
    expect(e.details).toEqual({ kind: 'file' });
    expect(e.message).toBe("This file couldn't be uploaded. Use a clear photo (JPG or PNG) or a PDF under 10 MB.");
  });

  it('a signature problem is the service, not the person', async () => {
    ending = { kind: 'load', status: 401, body: { error: { message: 'Invalid Signature abc' } } };
    const e = await failure();
    expect(e.details).toEqual({ kind: 'service' });
    expect(e.message).toBe(UPLOAD_UNAVAILABLE_COPY);
    expect(errorCopy(e.code, e.details)).toBe(UPLOAD_UNAVAILABLE_COPY);
  });

  it('classifies refusals by status and wording', () => {
    expect(cloudinaryRefusal(400, 'File size too large')).toBe('file');
    expect(cloudinaryRefusal(400, 'Stale request - reported time is …')).toBe('service');
    expect(cloudinaryRefusal(420, '')).toBe('service');
    expect(cloudinaryRefusal(502, '')).toBe('service');
  });

  it('an image-only purpose never suggests a PDF', () => {
    expect(uploadFileCopy({ allowedFormats: 'jpg,png', maxBytes: 5_000_000 })).toBe(
      "This file couldn't be uploaded. Use a clear photo (JPG or PNG) under 5 MB.",
    );
  });
});

describe('signing', () => {
  it('a server that cannot sign uploads reads as uploads being unavailable', async () => {
    media.signUpload.mockRejectedValue(
      new ApiError('File uploads are not configured on this server.', ERROR_CODES.SERVICE_UNAVAILABLE, 503),
    );
    await expect(signUpload('business_document')).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_FAILED,
      message: UPLOAD_UNAVAILABLE_COPY,
      details: { kind: 'service' },
    });
  });

  it('other refusals pass through as they are', async () => {
    media.signUpload.mockRejectedValue(new ApiError('Nope', ERROR_CODES.FORBIDDEN, 403));
    await expect(signUpload('business_document')).rejects.toMatchObject({ code: ERROR_CODES.FORBIDDEN });
  });
});
