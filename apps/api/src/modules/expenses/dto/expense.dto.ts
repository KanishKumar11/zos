import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { ExpenseCategory, ExpenseRecurring } from '../schemas/expense.schema';

const YMD = /^\d{4}-\d{2}-\d{2}/;
const YMD_MSG = 'Enter a date like 2026-04-01';

/** Present-but-null must fail (IsOptional would let `null` through and wipe a required field). */
const Present = () => ValidateIf((_o, v) => v !== undefined);
/** Optional link that may be cleared with '' or null. */
const ClearableId = () => ValidateIf((_o, v) => v !== undefined && v !== null && v !== '');

const toBool = ({ value }: { value: unknown }) =>
  value === true || value === 'true' ? true : value === false || value === 'false' ? false : value;

export class ExpenseContributionDto {
  @IsMongoId({ message: 'Pick a team member' }) userId!: string;
  @IsInt({ message: 'Enter an amount' }) @IsPositive({ message: 'Must be more than zero' }) @Type(() => Number)
  amountPaise!: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class CreateExpenseDto {
  @IsString() @IsNotEmpty({ message: 'Enter a title' }) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsInt({ message: 'Enter an amount' }) @IsPositive({ message: 'Must be more than zero' }) @Type(() => Number)
  amountPaise!: number;
  @IsEnum(ExpenseCategory) category!: ExpenseCategory;
  @IsString() @Matches(YMD, { message: YMD_MSG }) date!: string;
  @IsOptional() @IsString() @MaxLength(200) vendor?: string;
  @IsOptional() @IsString() @MaxLength(500) receiptRef?: string;
  @IsOptional() @IsString() currency?: string;
  @ClearableId() @IsMongoId({ message: 'Pick a project' }) projectId?: string | null;
  @IsOptional() @Transform(toBool) @IsBoolean() billable?: boolean;
  @IsOptional() @IsEnum(ExpenseRecurring) recurring?: ExpenseRecurring;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ExpenseContributionDto)
  contributions?: ExpenseContributionDto[];
}

export class UpdateExpenseDto {
  @Present() @IsString() @IsNotEmpty({ message: 'Enter a title' }) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @Present() @IsInt({ message: 'Enter an amount' }) @IsPositive({ message: 'Must be more than zero' }) @Type(() => Number)
  amountPaise?: number;
  @Present() @IsEnum(ExpenseCategory) category?: ExpenseCategory;
  @Present() @IsString() @Matches(YMD, { message: YMD_MSG }) date?: string;
  @IsOptional() @IsString() @MaxLength(200) vendor?: string;
  /** '' removes the receipt. */
  @IsOptional() @IsString() @MaxLength(500) receiptRef?: string;
  @IsOptional() @IsString() currency?: string;
  /** '' or null unlinks the project. */
  @ClearableId() @IsMongoId({ message: 'Pick a project' }) projectId?: string | null;
  @Present() @Transform(toBool) @IsBoolean() billable?: boolean;
  @Present() @IsEnum(ExpenseRecurring) recurring?: ExpenseRecurring;
  @Present()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ExpenseContributionDto)
  contributions?: ExpenseContributionDto[];
}

export const EXPENSE_SORTS = ['date:desc', 'date:asc', 'amount:desc', 'amount:asc'] as const;
export type ExpenseSort = (typeof EXPENSE_SORTS)[number];

export class ListExpensesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsEnum(ExpenseCategory) category?: ExpenseCategory;
  @IsOptional() @IsString() @Matches(YMD, { message: YMD_MSG }) from?: string;
  @IsOptional() @IsString() @Matches(YMD, { message: YMD_MSG }) to?: string;
  @IsOptional() @IsMongoId() contributorId?: string;
  @IsOptional() @IsMongoId() projectId?: string;
  @IsOptional() @Transform(toBool) @IsBoolean() billable?: boolean;
  @IsOptional() @IsEnum(ExpenseRecurring) recurring?: ExpenseRecurring;
  @IsOptional() @IsIn(EXPENSE_SORTS) sort?: ExpenseSort;
}

/** Same filters as the list, without paging/sorting — used by the summary. */
export class ExpenseSummaryQueryDto {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsEnum(ExpenseCategory) category?: ExpenseCategory;
  @IsOptional() @IsString() @Matches(YMD, { message: YMD_MSG }) from?: string;
  @IsOptional() @IsString() @Matches(YMD, { message: YMD_MSG }) to?: string;
  @IsOptional() @IsMongoId() contributorId?: string;
  @IsOptional() @IsMongoId() projectId?: string;
  @IsOptional() @Transform(toBool) @IsBoolean() billable?: boolean;
  @IsOptional() @IsEnum(ExpenseRecurring) recurring?: ExpenseRecurring;
}
