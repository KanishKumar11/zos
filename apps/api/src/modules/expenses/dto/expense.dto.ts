import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

import { ExpenseCategory } from '../schemas/expense.schema';

export class CreateExpenseDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() @IsPositive() @Type(() => Number) amountPaise!: number;
  @IsEnum(ExpenseCategory) category!: ExpenseCategory;
  @IsDateString() date!: string;
  @IsOptional() @IsString() vendor?: string;
  @IsOptional() @IsString() receiptRef?: string;
  @IsOptional() @IsString() currency?: string;
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
}
