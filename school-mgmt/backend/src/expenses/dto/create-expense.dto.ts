import { IsString, IsNotEmpty, IsNumber, Min, IsEnum, IsOptional, IsDateString, IsBoolean, IsMongoId } from 'class-validator';
import { ExpenseAllocationScope, ExpenseCategory, RecurringFrequency } from '../schemas/expense.schema';

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsDateString()
  expenseDate!: string;

  @IsEnum(ExpenseCategory)
  category!: string;

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

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @IsEnum(RecurringFrequency)
  @IsOptional()
  recurringFrequency?: string;

  @IsDateString()
  @IsOptional()
  recurringStartDate?: string;

  @IsDateString()
  @IsOptional()
  recurringEndDate?: string;
}
