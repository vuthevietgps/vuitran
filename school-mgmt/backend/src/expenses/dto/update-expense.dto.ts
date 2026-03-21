import { IsString, IsNumber, Min, IsEnum, IsOptional, IsDateString, IsMongoId } from 'class-validator';
import { ExpenseAllocationScope, ExpenseCategory } from '../schemas/expense.schema';

export class UpdateExpenseDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  @IsDateString()
  @IsOptional()
  expenseDate?: string;

  @IsEnum(ExpenseCategory)
  @IsOptional()
  category?: string;

  @IsEnum(ExpenseAllocationScope)
  @IsOptional()
  allocationScope?: string;

  @IsMongoId()
  @IsOptional()
  adGroupId?: string;

  @IsString()
  @IsOptional()
  adGroupName?: string;

  @IsMongoId()
  @IsOptional()
  parentUserId?: string;

  @IsString()
  @IsOptional()
  parentPhone?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
