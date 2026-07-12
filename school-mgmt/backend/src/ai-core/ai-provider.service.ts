import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiAssistantType, AiAssistantStatus } from '../chatbot/schemas/ai-assistant-profile.schema';
import { ChatbotService } from '../chatbot/chatbot.service';
import { AiOpenAIConfig, AiOpenAIResult } from './ai-core.types';
import { buildOpenAIChatBody } from '../common/utils/openai-chat-options';
import { extractOpenAIApiKey } from '../common/utils/openai-api-key';

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);

  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly configService: ConfigService,
  ) {}

  async resolveOpenAIConfig(assistantType: AiAssistantType): Promise<AiOpenAIConfig | null> {
    const profiles = await this.chatbotService.findAllAiAssistantProfiles();
    const profile = profiles.find((item: any) =>
      item.assistantType === assistantType && item.status === AiAssistantStatus.ACTIVE,
    );

    const profileTokenId = (profile as any)?.defaultOpenAITokenId;
    if (profileTokenId) {
      const dbConfig = await this.chatbotService.getDecryptedOpenAIKey(profileTokenId);
      if (dbConfig?.key) {
        return { ...dbConfig, source: 'DB_TOKEN' };
      }
    }

    const tokens = await this.chatbotService.findAllOpenAITokens();
    const fallbackToken = tokens.find((item: any) => item.status === 'ACTIVE');
    if (fallbackToken?._id) {
      const dbConfig = await this.chatbotService.getDecryptedOpenAIKey(fallbackToken._id);
      if (dbConfig?.key) {
        return { ...dbConfig, source: 'DB_TOKEN' };
      }
    }

    const rawEnvKey = this.configService.get<string>('OPENAI_API_KEY') || process.env.OPENAI_API_KEY;
    const envKey = extractOpenAIApiKey(rawEnvKey);
    if (!envKey) {
      if (rawEnvKey?.trim()) {
        this.logger.warn('OPENAI_API_KEY is configured but does not contain a valid sk- API key');
      }
      return null;
    }

    return {
      key: envKey,
      model: this.configService.get<string>('OPENAI_MODEL', 'gpt-5.4-mini'),
      temperature: Number(this.configService.get<string>('OPENAI_TEMPERATURE', '0.2')),
      maxTokens: Number(this.configService.get<string>('OPENAI_MAX_TOKENS', '1400')),
      systemPromptPrefix: this.configService.get<string>('OPENAI_SYSTEM_PROMPT_PREFIX'),
      source: 'ENV',
    };
  }

  async callOpenAI(config: AiOpenAIConfig, messages: Array<{ role: string; content: string }>): Promise<AiOpenAIResult> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.key}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify(buildOpenAIChatBody({
          model: config.model,
          messages,
          temperature: Math.min(config.temperature ?? 0.2, 0.4),
          maxTokens: Math.min(config.maxTokens ?? 1400, 1800),
        })),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${body.slice(0, 500)}`);
      }

      const result = await response.json() as any;
      const content = String(result?.choices?.[0]?.message?.content || '').trim()
        || 'Khong co noi dung tra loi tu AI API.';
      const promptText = messages.map((message) => `${message.role}: ${message.content}`).join('\n');
      const estimatedPromptTokens = this.estimateTokens(promptText);
      const estimatedCompletionTokens = this.estimateTokens(content);

      return {
        content,
        model: result?.model || config.model,
        latencyMs: Date.now() - startedAt,
        usage: {
          promptTokens: result?.usage?.prompt_tokens,
          completionTokens: result?.usage?.completion_tokens,
          totalTokens: result?.usage?.total_tokens,
          estimatedPromptTokens,
          estimatedCompletionTokens,
          estimatedTotalTokens: estimatedPromptTokens + estimatedCompletionTokens,
        },
      };
    } catch (err) {
      this.logger.warn(`AI provider call failed: ${this.getErrorMessage(err)}`);
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message.trim()) return error.message;
    return 'Unknown OpenAI error';
  }

  private estimateTokens(text: string) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }
}
