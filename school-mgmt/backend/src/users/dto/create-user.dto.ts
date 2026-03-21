import {
  IsArray,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../common/interfaces/role.enum';

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
}
