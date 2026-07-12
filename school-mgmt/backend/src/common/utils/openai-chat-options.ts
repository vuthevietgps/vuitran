type ChatMessage = { role: string; content: string };

interface OpenAIChatBodyOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

function isReasoningFamilyModel(model: string) {
  const normalized = model.trim().toLowerCase();
  return (
    normalized.startsWith('gpt-5') ||
    normalized.startsWith('o1') ||
    normalized.startsWith('o3') ||
    normalized.startsWith('o4') ||
    normalized === 'chat-latest'
  );
}

export function buildOpenAIChatBody(options: OpenAIChatBodyOptions) {
  const maxTokens = Math.max(1, Math.floor(options.maxTokens ?? 1000));
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
  };

  if (isReasoningFamilyModel(options.model)) {
    body.max_completion_tokens = maxTokens;
    return body;
  }

  body.temperature = options.temperature;
  body.max_tokens = maxTokens;
  return body;
}
