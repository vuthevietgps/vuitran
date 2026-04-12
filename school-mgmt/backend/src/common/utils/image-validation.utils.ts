import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';

/**
 * Shared image validation utilities for secure file upload handling.
 */
export interface ImageValidationResult {
  buffer: Buffer;
  extension: string;
  filename: string;
}

/**
 * Validate and process base64 image data with security checks.
 * Only JPEG, PNG, and WebP are allowed for attendance submissions.
 */
export function validateAndProcessBase64Image(
  base64Data: string,
  maxSizeMB: number = 5,
  prefix: string = 'image',
): ImageValidationResult {
  if (typeof base64Data !== 'string' || !base64Data.trim()) {
    throw new BadRequestException('Dữ liệu ảnh base64 không hợp lệ');
  }

  const normalizedBase64Data = base64Data.trim();
  const maxBytes = maxSizeMB * 1024 * 1024;
  const estimatedSize = normalizedBase64Data.length * 0.75;

  if (estimatedSize > maxBytes) {
    throw new BadRequestException(`Kích thước ảnh quá lớn (tối đa ${maxSizeMB}MB)`);
  }

  const mimeMatch = normalizedBase64Data.match(
    /^data:(image\/(jpeg|jpg|png|webp));base64,/,
  );
  if (!mimeMatch) {
    throw new BadRequestException('Ảnh phải có định dạng JPEG, PNG hoặc WebP');
  }

  const ext = mimeMatch[2] === 'jpeg' ? 'jpg' : mimeMatch[2];
  const base64Content = normalizedBase64Data.replace(/^data:image\/\w+;base64,/, '');

  if (!base64Content) {
    throw new BadRequestException('Dữ liệu base64 không hợp lệ');
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Content, 'base64');
  } catch {
    throw new BadRequestException('Dữ liệu base64 không hợp lệ');
  }

  if (buffer.length > maxBytes) {
    throw new BadRequestException(
      `Kích thước ảnh thực tế vượt quá giới hạn ${maxSizeMB}MB`,
    );
  }

  if (!validateImageMagicBytes(buffer, ext)) {
    throw new BadRequestException(`File không phải ảnh ${ext.toUpperCase()} hợp lệ`);
  }

  const randomSuffix = randomBytes(8).toString('hex');
  const timestamp = Date.now();
  const filename = `${prefix}_${timestamp}_${randomSuffix}.${ext}`;

  return { buffer, extension: ext, filename };
}

function validateImageMagicBytes(buffer: Buffer, expectedExt: string): boolean {
  if (buffer.length < 12) return false;

  const magicBytes = buffer.slice(0, 12);

  switch (expectedExt) {
    case 'jpg':
      return magicBytes[0] === 0xff && magicBytes[1] === 0xd8 && magicBytes[2] === 0xff;
    case 'png':
      return (
        magicBytes[0] === 0x89 &&
        magicBytes[1] === 0x50 &&
        magicBytes[2] === 0x4e &&
        magicBytes[3] === 0x47
      );
    case 'webp':
      return (
        magicBytes[0] === 0x52 &&
        magicBytes[1] === 0x49 &&
        magicBytes[2] === 0x46 &&
        magicBytes[3] === 0x46 &&
        magicBytes[8] === 0x57 &&
        magicBytes[9] === 0x45 &&
        magicBytes[10] === 0x42 &&
        magicBytes[11] === 0x50
      );
    default:
      return false;
  }
}
