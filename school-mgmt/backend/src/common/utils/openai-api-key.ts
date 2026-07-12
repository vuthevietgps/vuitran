const OPENAI_API_KEY_PATTERN = /sk-[A-Za-z0-9_-]{20,}/;

export function extractOpenAIApiKey(value: string | null | undefined): string | null {
  const text = String(value || '').trim();
  if (!text) return null;

  const match = text.match(OPENAI_API_KEY_PATTERN);
  return match?.[0] || null;
}

export function isCleanOpenAIApiKey(value: string | null | undefined): boolean {
  const text = String(value || '').trim();
  return Boolean(text && extractOpenAIApiKey(text) === text);
}
