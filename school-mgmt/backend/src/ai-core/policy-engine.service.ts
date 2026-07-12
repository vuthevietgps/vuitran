import { ForbiddenException, Injectable } from '@nestjs/common';
import { AiAssistantType } from '../chatbot/schemas/ai-assistant-profile.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { getAiCoreAssistantProfile } from './catalogs/assistant-profile.catalog';
import { getAiCoreToolDefinition } from './catalogs/tool.catalog';
import { AiSituationDefinition, AiToolDefinition } from './ai-core.types';

@Injectable()
export class AiPolicyEngineService {
  assertAssistantAllowed(user: JwtPayload, assistantType: AiAssistantType) {
    const profile = getAiCoreAssistantProfile(assistantType);
    if (!profile) {
      throw new ForbiddenException('Assistant type khong duoc ho tro');
    }
    if (!profile.primaryRoles.includes(user.role)) {
      throw new ForbiddenException('Role hien tai khong duoc dung assistant nay');
    }
    return profile;
  }

  assertSituationAllowed(
    user: JwtPayload,
    assistantType: AiAssistantType,
    situation: AiSituationDefinition,
  ) {
    this.assertAssistantAllowed(user, assistantType);
    if (!situation.allowedAssistantTypes.includes(assistantType) || !situation.allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Situation nay khong nam trong quyen cua assistant/user');
    }
    if (situation.operation === 'WRITE_EXECUTE') {
      throw new ForbiddenException('AI core hien chi cho phep read-only va preview, chua execute write action');
    }
  }

  getAllowedToolsForSituation(
    user: JwtPayload,
    assistantType: AiAssistantType,
    situation: AiSituationDefinition,
  ): AiToolDefinition[] {
    this.assertSituationAllowed(user, assistantType, situation);

    const tools = situation.candidateTools
      .map((key) => getAiCoreToolDefinition(key))
      .filter((tool): tool is AiToolDefinition => Boolean(tool))
      .filter((tool) => this.isToolAllowed(user, assistantType, tool))
      .filter((tool) => tool.operation !== 'WRITE_EXECUTE');

    if (!tools.length) {
      throw new ForbiddenException('Khong co tool doc du lieu nao duoc phep cho situation nay');
    }

    return tools;
  }

  isToolAllowed(user: JwtPayload, assistantType: AiAssistantType, tool: AiToolDefinition) {
    if (!tool.enabled) return false;
    if (!tool.allowedRoles.includes(user.role)) return false;
    if (!tool.allowedAssistantTypes.includes(assistantType)) return false;
    if (tool.operation === 'WRITE_EXECUTE') return false;
    return true;
  }
}
