import { buildOpenAIChatBody } from './openai-chat-options';

describe('buildOpenAIChatBody', () => {
  const messages = [{ role: 'user', content: 'Xin chao' }];

  it('uses max_completion_tokens and omits temperature for reasoning-family models', () => {
    const body = buildOpenAIChatBody({
      model: 'gpt-5.4-mini',
      messages,
      temperature: 0.7,
      maxTokens: 1200,
    });

    expect(body).toEqual({
      model: 'gpt-5.4-mini',
      messages,
      max_completion_tokens: 1200,
    });
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('max_tokens');
  });

  it('uses legacy chat-completions fields for non-reasoning models', () => {
    const body = buildOpenAIChatBody({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.5,
      maxTokens: 700,
    });

    expect(body).toEqual({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.5,
      max_tokens: 700,
    });
  });

  it('clamps max tokens to at least one integer', () => {
    const body = buildOpenAIChatBody({
      model: 'gpt-4o-mini',
      messages,
      maxTokens: 0,
    });

    expect(body.max_tokens).toBe(1);
  });
});
