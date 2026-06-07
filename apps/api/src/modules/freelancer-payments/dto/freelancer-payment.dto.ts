import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFreelancerPaymentDto {
  @IsString() freelancerName!: string;
  @IsOptional() @IsString() email?: string;
  @IsString() projectRef!: string;
  @IsOptional() @IsString() projectId?: string;
  @IsNumber() @IsPositive() @Type(() => Number) agreedTotalPaise!: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateFreelancerPaymentDto {
  @IsOptional() @IsString() freelancerName?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() projectRef?: string;
  @IsOptional() @IsNumber() @IsPositive() @Type(() => Number) agreedTotalPaise?: number;
  @IsOptional() @IsEnum(['ACTIVE', 'COMPLETED', 'CANCELLED']) status?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() notes?: string;
}

export class AddFreelancerPaymentEntryDto {
  @IsDateString() date!: string;
  @IsNumber() @IsPositive() @Type(() => Number) amountPaise!: number;
  @IsOptional() @IsString() note?: string;
}
