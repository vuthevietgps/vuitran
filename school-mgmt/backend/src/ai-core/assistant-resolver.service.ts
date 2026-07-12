import { ForbiddenException, Injectable } from '@nestjs/common';
import { AiAssistantType } from '../chatbot/schemas/ai-assistant-profile.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import {
  getAiCoreAssistantProfile,
  inferAssistantTypeForRole,
} from './catalogs/assistant-profile.catalog';

@Injectable()
export class AiAssistantResolverService {
  resolveAssistantType(user: JwtPayload, requested?: AiAssistantType): AiAssistantType {
    const assistantType = requested || inferAssistantTypeForRole(user.role);
    const profile = getAiCoreAssistantProfile(assistantType);
    if (!profile) {
      throw new ForbiddenException('Assistant type khong duoc ho tro');
    }
    if (!profile.primaryRoles.includes(user.role)) {
      throw new ForbiddenException('Role hien tai khong duoc dung assistant nay');
    }
    return assistantType;
  }

  getProfile(assistantType: AiAssistantType) {
    const profile = getAiCoreAssistantProfile(assistantType);
    if (!profile) {
      throw new ForbiddenException('Assistant profile khong ton tai');
    }
    return profile;
  }
}
