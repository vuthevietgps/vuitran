import { IsOptional, IsString, IsEnum, IsNumberString } from 'class-validator';
import { AgentStatus, AgentTier } from '../schemas/agent.schema';

export class QueryAgentDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(AgentStatus)
  status?: AgentStatus;

  @IsOptional()
  @IsEnum(AgentTier)
  tier?: AgentTier;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
