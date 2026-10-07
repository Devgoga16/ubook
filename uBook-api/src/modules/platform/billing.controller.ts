import { Body, Controller, Get, Post } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { AllowWhenReadOnly, CurrentActor, RequirePermission } from '../../core/auth/decorators.js';
import { TenantContext, type Actor } from '../../core/tenancy/tenant-context.js';
import { BillingService } from './billing.service.js';
import { BILLING_METHODS, type BillingMethod } from './schemas/subscription-payment.schema.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ReportPaymentDto {
  @Matches(/^[a-z0-9_-]{2,40}$/)
  planCode: string;

  @IsIn(['monthly', 'yearly'])
  billingCycle: 'monthly' | 'yearly';

  /** Céntimos. */
  @IsInt()
  @Min(1)
  amount: number;

  @IsIn(['PEN', 'USD'])
  currency: 'PEN' | 'USD';

  @IsIn(BILLING_METHODS)
  method: BillingMethod;

  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Escribe el número de operación' })
  @MaxLength(60)
  reference: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  paidOn: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  note?: string;
}

/** Plan y pagos del negocio. Funciona aunque la prueba haya vencido (para poder pagar). */
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @RequirePermission('subscription.manage')
  @AllowWhenReadOnly()
  @Get()
  overview() {
    return this.billing.overview(TenantContext.requireOrganizationId());
  }

  @RequirePermission('subscription.manage')
  @AllowWhenReadOnly()
  @Post('payments')
  report(@CurrentActor() actor: Actor, @Body() dto: ReportPaymentDto) {
    return this.billing.report(TenantContext.requireOrganizationId(), actor.userId, dto);
  }
}
