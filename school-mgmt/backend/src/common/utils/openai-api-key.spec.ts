import { extractOpenAIApiKey, isCleanOpenAIApiKey } from './openai-api-key';

describe('openai api key helpers', () => {
  it('extracts an sk key from pasted text', () => {
    const key = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456';
    expect(extractOpenAIApiKey(`Dung ${key} la AI API key`)).toBe(key);
  });

  it('rejects text without an sk key', () => {
    expect(extractOpenAIApiKey('khong co token')).toBeNull();
  });

  it('detects clean key input', () => {
    expect(isCleanOpenAIApiKey('sk-proj-abcdefghijklmnopqrstuvwxyz123456')).toBe(true);
    expect(isCleanOpenAIApiKey('sk-proj-abcdefghijklmnopqrstuvwxyz123456 trailing')).toBe(false);
  });
});
