// A provider's PDF shows as page images: Cloudinary's plan refuses to deliver
// the PDF file itself (401 "deny or ACL failure", the owner's report of
// 2026-11-25) but renders each page as a JPEG.

import { PixelRatio } from 'react-native';
import { pdfPage } from '../cdn/cdn';

const PDF = 'https://res.cloudinary.com/demo/image/upload/v17/metromatrix/production/u1/business_document/abc.pdf';

beforeEach(() => jest.spyOn(PixelRatio, 'get').mockReturnValue(2));

describe('pdfPage', () => {
  it("renders a page as a JPEG at the device's pixel ratio", () => {
    expect(pdfPage(PDF, 3, { w: 300 })).toBe(
      'https://res.cloudinary.com/demo/image/upload/pg_3,f_jpg,w_600,c_limit,q_auto/v17/metromatrix/production/u1/business_document/abc.jpg',
    );
  });

  it('answers null for anything it cannot render', () => {
    expect(pdfPage(null, 1, { w: 100 })).toBeNull();
    expect(pdfPage('https://res.cloudinary.com/demo/raw/upload/v1/a.pdf', 1, { w: 100 })).toBeNull();
    expect(pdfPage('https://res.cloudinary.com/demo/image/upload/v1/a.jpg', 1, { w: 100 })).toBeNull();
    expect(pdfPage('file:///cache/scan.pdf', 1, { w: 100 })).toBeNull();
  });
});
