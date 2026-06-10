import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateInternshipLetterDto {
  @IsString() candidateName!: string;
  @IsString() candidateEmail!: string;
  @IsOptional() @IsString() candidateAddress?: string;
  @IsOptional() @IsString() candidateCity?: string;
  @IsOptional() @IsString() candidatePhone?: string;
  @IsString() position!: string;
  @IsString() department!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsNumber() @IsPositive() @Min(0) @Type(() => Number) stipendAmount!: number;
  @IsOptional() @IsString() manager?: string;
  @IsOptional() @IsString() workHours?: string;
  @IsOptional() @IsString() workDays?: string;
  @IsOptional() @IsString() workMode?: string;
  @IsOptional() @IsString() acceptanceDeadline?: string;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsString() referenceNumber?: string;
}
