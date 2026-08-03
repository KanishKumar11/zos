import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

import { ExpenseCategory } from '../schemas/expense.schema';

export class ExpenseContributionDto {
  @IsMongoId() userId!: string;
  @IsNumber() @IsPositive() @Type(() => Number) amountPaise!: number;
  @IsOptional() @IsString() note?: string;
}

export class CreateExpenseDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() @IsPositive() @Type(() => Number) amountPaise!: number;
  @IsEnum(ExpenseCategory) category!: ExpenseCategory;
  @IsDateString() date!: string;
  @IsOptional() @IsString() vendor?: string;
  @IsOptional() @IsString() receiptRef?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseContributionDto)
  contributions?: ExpenseContributionDto[];
}

export class UpdateExpenseDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @IsPositive() @Type(() => Number) amountPaise?: number;
  @IsOptional() @IsEnum(ExpenseCategory) category?: ExpenseCategory;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() vendor?: string;
  @IsOptional() @IsString() receiptRef?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseContributionDto)
  contributions?: ExpenseContributionDto[];
}
