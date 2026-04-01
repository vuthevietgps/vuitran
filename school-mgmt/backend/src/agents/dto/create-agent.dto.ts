import { IsString, IsOptional, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { AgentTier } from '../schemas/agent.schema';

export class CreateAgentDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  taxCode?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  bankAccountHolder?: string;

  @IsOptional()
  @IsEnum(AgentTier)
  tier?: AgentTier;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
