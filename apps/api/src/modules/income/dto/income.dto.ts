import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

import { IncomeCategory } from '../schemas/income.schema';

export class CreateIncomeDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() @IsPositive() @Type(() => Number) amountPaise!: number;
  @IsEnum(IncomeCategory) category!: IncomeCategory;
  @IsDateString() date!: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() receiptRef?: string;
  @IsOptional() @IsString() currency?: string;
}

export class UpdateIncomeDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @IsPositive() @Type(() => Number) amountPaise?: number;
  @IsOptional() @IsEnum(IncomeCategory) category?: IncomeCategory;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() receiptRef?: string;
  @IsOptional() @IsString() currency?: string;
}
