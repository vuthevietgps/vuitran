export const ONE_BY_ONE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+VXwAAAAASUVORK5CYII=';

export const ONE_BY_ONE_PNG_BUFFER = Buffer.from(ONE_BY_ONE_PNG_BASE64, 'base64');

export function pngFilePayload(name = 'e2e-1x1.png') {
  return {
    name,
    mimeType: 'image/png',
    buffer: ONE_BY_ONE_PNG_BUFFER,
  };
}
