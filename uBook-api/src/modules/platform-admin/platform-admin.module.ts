import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { OrganizationModule } from '../organization/organization.module.js';
import { PlatformModule } from '../platform/platform.module.js';
import { PlatformBootstrapService } from './platform-bootstrap.service.js';
import { PlatformBillingController } from './platform-billing.controller.js';
import { PlatformOrganizationsController } from './platform-organizations.controller.js';

/** Panel de super admin: negocios, suscripciones y arranque de la plataforma. */
@Module({
  imports: [IdentityModule, OrganizationModule, PlatformModule],
  controllers: [PlatformOrganizationsController, PlatformBillingController],
  providers: [PlatformBootstrapService],
})
export class PlatformAdminModule {}
