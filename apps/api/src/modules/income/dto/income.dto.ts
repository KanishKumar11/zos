import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

import { IncomeCategory } from '../schemas/income.schema';

const YMD = /^\d{4}-\d{2}-\d{2}/;
const YMD_MSG = 'Enter a date like 2026-04-01';
/** Present-but-null must fail (IsOptional would let `null` through and wipe a required field). */
const Present = () => ValidateIf((_o, v) => v !== undefined);

export class CreateIncomeDto {
  @IsString() @IsNotEmpty({ message: 'Enter a title' }) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsInt({ message: 'Enter an amount' }) @IsPositive({ message: 'Must be more than zero' }) @Type(() => Number)
  amountPaise!: number;
  @IsEnum(IncomeCategory) category!: IncomeCategory;
  @IsString() @Matches(YMD, { message: YMD_MSG }) date!: string;
  @IsOptional() @IsString() @MaxLength(200) source?: string;
  @IsOptional() @IsString() @MaxLength(500) receiptRef?: string;
  @IsOptional() @IsString() currency?: string;
}

export class UpdateIncomeDto {
  @Present() @IsString() @IsNotEmpty({ message: 'Enter a title' }) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @Present() @IsInt({ message: 'Enter an amount' }) @IsPositive({ message: 'Must be more than zero' }) @Type(() => Number)
  amountPaise?: number;
  @Present() @IsEnum(IncomeCategory) category?: IncomeCategory;
  @Present() @IsString() @Matches(YMD, { message: YMD_MSG }) date?: string;
  @IsOptional() @IsString() @MaxLength(200) source?: string;
  /** '' removes the receipt. */
  @IsOptional() @IsString() @MaxLength(500) receiptRef?: string;
  @IsOptional() @IsString() currency?: string;
}

export const INCOME_SORTS = ['date:desc', 'date:asc', 'amount:desc', 'amount:asc'] as const;
export type IncomeSort = (typeof INCOME_SORTS)[number];

export class IncomeSummaryQueryDto {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsEnum(IncomeCategory) category?: IncomeCategory;
  @IsOptional() @IsString() @Matches(YMD, { message: YMD_MSG }) from?: string;
  @IsOptional() @IsString() @Matches(YMD, { message: YMD_MSG }) to?: string;
}

export class ListIncomeQueryDto extends IncomeSummaryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) pageSize?: number;
  @IsOptional() @IsIn(INCOME_SORTS) sort?: IncomeSort;
}
