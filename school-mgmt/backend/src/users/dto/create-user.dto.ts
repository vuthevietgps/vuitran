import {
  IsArray,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '../../common/interfaces/role.enum';
import { CreateUserSalaryConfigDto } from './create-user-salary-config.dto';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  userCode!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsEnum(Role)
  @IsNotEmpty()
  role!: Role;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  facebookLink?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsMongoId()
  @IsOptional()
  saleOwnerId?: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  managedSales?: string[];

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @IsOptional()
  ownershipPercentage?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateUserSalaryConfigDto)
  salaryConfig?: CreateUserSalaryConfigDto;
}
