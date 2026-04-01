import { ArrayNotEmpty, ArrayUnique, IsArray, IsMongoId, IsOptional } from 'class-validator';

export class AssignStudentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsMongoId({ each: true })
  studentIds!: string[];

  @IsMongoId()
  @IsOptional()
  invoiceId?: string;
}
