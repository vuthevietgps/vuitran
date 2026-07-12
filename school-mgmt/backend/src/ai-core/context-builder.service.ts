import { Injectable } from '@nestjs/common';
import { AiAuthContext, AiToolDefinition, AiToolInput, AiToolResult } from './ai-core.types';
import { AiToolRegistryService } from './tool-registry.service';

export interface AiContextItem {
  key: string;
  label: string;
  catalog: {
    businessName: string;
    businessMeaning: string;
    route: string;
    serviceMethod: string;
    operation: string;
    dataScope: string;
    contextPolicy: string;
    riskLevel: string;
    requiresConfirmation: boolean;
  };
  data: unknown;
  metadata: AiToolResult['metadata'];
}

const MAX_CONTEXT_TOOLS = 5;
const MAX_CONTEXT_CHARS = 24000;

@Injectable()
export class AiContextBuilderService {
  constructor(private readonly toolRegistry: AiToolRegistryService) {}

  async buildContext(
    tools: AiToolDefinition[],
    input: AiToolInput,
    auth: AiAuthContext,
  ): Promise<AiContextItem[]> {
    const selectedTools = tools.slice(0, MAX_CONTEXT_TOOLS);
    const results = await Promise.all(
      selectedTools.map(async (tool) => {
        try {
          const result = await this.toolRegistry.execute(tool.key, input, auth);
          return this.mapResult(tool, result);
        } catch (err) {
          return this.mapFailure(tool, err);
        }
      }),
    );

    return this.compactContext(results);
  }

  private mapResult(tool: AiToolDefinition, result: AiToolResult): AiContextItem {
    return {
      key: tool.key,
      label: tool.label,
      catalog: this.catalogSummary(tool),
      data: this.compactValue(result.data),
      metadata: result.metadata,
    };
  }

  private mapFailure(tool: AiToolDefinition, error: unknown): AiContextItem {
    return {
      key: tool.key,
      label: tool.label,
      catalog: this.catalogSummary(tool),
      data: null,
      metadata: {
        truncated: false,
        warnings: [this.getErrorMessage(error)],
      },
    };
  }

  private catalogSummary(tool: AiToolDefinition) {
    return {
      businessName: tool.businessName,
      businessMeaning: tool.businessMeaning,
      route: tool.route,
      serviceMethod: tool.serviceMethod,
      operation: tool.operation,
      dataScope: tool.dataScope,
      contextPolicy: tool.contextPolicy,
      riskLevel: tool.riskLevel,
      requiresConfirmation: tool.requiresConfirmation,
    };
  }

  private compactContext(context: AiContextItem[]) {
    let compacted = context;
    while (JSON.stringify(compacted).length > MAX_CONTEXT_CHARS && compacted.length > 1) {
      compacted = compacted.slice(0, -1);
    }
    return compacted;
  }

  private compactValue(value: any, depth = 0): any {
    if (value == null) return value;
    if (typeof value !== 'object') return value;
    if (value instanceof Date) return value.toISOString();
    if (depth >= 5) return '[truncated]';

    if (Array.isArray(value)) {
      const limit = depth <= 1 ? 8 : 5;
      return {
        totalItems: value.length,
        shownItems: value.slice(0, limit).map((item) => this.compactValue(item, depth + 1)),
        truncated: value.length > limit,
      };
    }

    const output: Record<string, any> = {};
    const entries = Object.entries(value).slice(0, 40);
    for (const [key, childValue] of entries) {
      if (key === '__v') continue;
      if (this.isSensitiveKey(key)) {
        output[key] = '[redacted]';
        continue;
      }
      output[key] = this.compactValue(childValue, depth + 1);
    }
    return output;
  }

  private isSensitiveKey(key: string) {
    const normalized = key.toLowerCase();
    return normalized.includes('token')
      || normalized.includes('secret')
      || normalized.includes('apikey')
      || normalized.includes('api_key')
      || normalized.includes('password')
      || normalized.includes('receipt')
      || normalized.includes('proof')
      || normalized.includes('image')
      || normalized.includes('photo')
      || normalized.includes('attachment')
      || normalized.includes('file')
      || normalized.includes('accountnumber')
      || normalized.includes('cardnumber');
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return 'Tool execution failed';
  }
}
