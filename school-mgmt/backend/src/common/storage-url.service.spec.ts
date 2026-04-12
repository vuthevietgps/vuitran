import { StorageUrlService } from './storage-url.service';

describe('StorageUrlService', () => {
  const previousSecret = process.env.ASSET_URL_SIGNING_SECRET;
  let service: StorageUrlService;

  beforeEach(() => {
    process.env.ASSET_URL_SIGNING_SECRET = 'unit-test-secret';
    service = new StorageUrlService();
  });

  afterEach(() => {
    process.env.ASSET_URL_SIGNING_SECRET = previousSecret;
  });

  it('creates a signed secure-assets URL for internal upload paths', () => {
    const signedUrl = service.generatePresignedUrl('/uploads/attendance/selfie-001.png', 15);

    expect(signedUrl).toContain('/secure-assets?');
    expect(signedUrl).toContain('key=attendance%2Fselfie-001.png');

    const parsed = new URL(signedUrl as string, 'http://localhost');
    const verified = service.verifySignedAssetRequest({
      key: parsed.searchParams.get('key') || undefined,
      exp: parsed.searchParams.get('exp') || undefined,
      sig: parsed.searchParams.get('sig') || undefined,
    });

    expect(verified.assetKey).toBe('attendance/selfie-001.png');
  });

  it('leaves external URLs untouched', () => {
    const external = 'https://example.com/recording.mp4';

    expect(service.generatePresignedUrl(external)).toBe(external);
    expect(service.extractAssetKey(external)).toBeNull();
  });

  it('normalizes attendance URLs from the legacy storage domain', () => {
    const legacyUrl = 'https://storage.school.vn/attendance/20260208_093000_HS2024001.jpg';

    expect(service.extractAssetKey(legacyUrl)).toBe('attendance/20260208_093000_HS2024001.jpg');
    expect(service.generatePresignedUrl(legacyUrl)).toContain('/secure-assets?');
  });

  it('transforms nested sensitive fields in payloads', () => {
    const payload = {
      imageUrl: '/uploads/attendance/selfie-002.png',
      teachingReport: {
        recordingUrl: '/uploads/recordings/session-002.mp4',
      },
      nested: [
        { recordLink: '/uploads/recordings/session-003.mp4' },
      ],
    };

    const transformed = service.transformSensitiveAssetUrls(payload);

    expect(transformed.imageUrl).toContain('/secure-assets?');
    expect(transformed.teachingReport.recordingUrl).toContain('/secure-assets?');
    expect(transformed.nested[0].recordLink).toContain('/secure-assets?');
  });
});
