import { BadRequestException } from '@nestjs/common';
import { validateAndProcessBase64Image } from './image-validation.utils';

function makeDataUri(mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', bytes: number[]): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}

describe('validateAndProcessBase64Image', () => {
  it('accepts a png base64 image and returns a safe filename', () => {
    const payload = makeDataUri('image/png', [
      0x89, 0x50, 0x4e, 0x47,
      0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x00,
      0x12, 0x34, 0x56, 0x78,
    ]);

    const result = validateAndProcessBase64Image(payload, 1, 'attendance');

    expect(result.extension).toBe('png');
    expect(result.filename.startsWith('attendance_')).toBe(true);
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it('accepts a webp base64 image even when padded with whitespace', () => {
    const payload =
      `  ${makeDataUri('image/webp', [
        0x52, 0x49, 0x46, 0x46,
        0x24, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50,
        0x00, 0x01, 0x02, 0x03,
      ])}  `;

    const result = validateAndProcessBase64Image(payload, 1, 'attendance');

    expect(result.extension).toBe('webp');
    expect(result.filename).toContain('.webp');
  });

  it('rejects gif images', () => {
    const payload = makeDataUri('image/gif', [
      0x47, 0x49, 0x46, 0x38,
      0x39, 0x61, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ]);

    expect(() => validateAndProcessBase64Image(payload, 1, 'attendance')).toThrow(
      BadRequestException,
    );
  });
});
