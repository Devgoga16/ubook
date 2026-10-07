import { Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import {
  SUBSCRIPTION_STATUSES,
  type BillingCycle,
  type SubscriptionStatus,
} from '../platform/schemas/subscription.schema.js';
import type { FeatureValue } from '../platform/features.catalog.js';

export class ListOrganizationsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}

export class UpdateSubscriptionDto {
  @IsOptional()
  @Matches(/^[a-z0-9_-]{2,40}$/)
  planCode?: string;

  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsIn(['monthly', 'yearly'])
  billingCycle?: BillingCycle;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  trialEndsAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  currentPeriodEnd?: Date;

  /** `{ max_professionals: 12 }`; `null` quita la excepción. */
  @IsOptional()
  @IsObject()
  overrides?: Record<string, FeatureValue | null>;
}

export class UpdateOrganizationStatusDto {
  @IsIn(['active', 'suspended'])
  status: 'active' | 'suspended';
}
