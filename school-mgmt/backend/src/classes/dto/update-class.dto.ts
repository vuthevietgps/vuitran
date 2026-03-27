import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateClassDto } from './create-class.dto';
import { PendingClassUpdateType } from '../schemas/class.schema';

export class UpdateClassDto extends PartialType(CreateClassDto) {
  @IsEnum(PendingClassUpdateType)
  @IsOptional()
  requestType?: PendingClassUpdateType;
}
