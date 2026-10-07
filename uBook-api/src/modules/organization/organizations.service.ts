import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { Types, type ClientSession, type Connection, type Model } from 'mongoose';
import { AuditService } from '../../core/audit/audit.service.js';
import { DEFAULT_ROLE_TEMPLATES, OWNER_ROLE_KEY } from '../../core/authorization/permissions.catalog.js';
import { Errors } from '../../core/common/errors.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';
import { EntitlementsService } from '../platform/entitlements.service.js';
import { SubscriptionsService } from '../platform/subscriptions.service.js';
import type { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto.js';
import { Branch } from './schemas/branch.schema.js';
import { Membership, type MembershipDocument } from './schemas/membership.schema.js';
import { Organization, type OrganizationDocument } from './schemas/organization.schema.js';
import { Role } from './schemas/role.schema.js';
import { User } from '../identity/schemas/user.schema.js';
import { Professional } from '../professionals/schemas/professional.schema.js';

export const DEFAULT_TIMEZONE = 'America/Lima';

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'negocio';
}

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Organization.name) private readonly organizations: Model<Organization>,
    @InjectModel(Branch.name) private readonly branches: Model<Branch>,
    @InjectModel(Role.name) private readonly roles: Model<Role>,
    @InjectModel(Membership.name) private readonly memberships: Model<Membership>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Professional.name) private readonly professionals: Model<Professional>,
    private readonly subscriptions: SubscriptionsService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService,
  ) {}

  /** Ejecuta `fn` en una transacción de Mongo (requiere replica set). */
  transaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
    return this.connection.transaction(fn);
  }

  /**
   * Crea un negocio completo: organización, roles por defecto, sucursal
   * principal, membresía de Dueño y suscripción en prueba gratis.
   */
  async createWithOwner(
    ownerUserId: string,
    input: CreateOrganizationDto,
    session: ClientSession,
  ): Promise<{ organization: OrganizationDocument; membership: MembershipDocument }> {
    const organizationId = new Types.ObjectId();
    const timezone = input.timezone ?? DEFAULT_TIMEZONE;
    const slug = await this.availableSlug(slugify(input.name), session);

    const [organization] = await this.organizations.create(
      [
        {
          _id: organizationId,
          name: input.name,
          slug,
          timezone,
          country: input.country,
          currency: input.currency,
          businessType: input.businessType,
          createdBy: ownerUserId,
        },
      ],
      { session },
    );

    const membership = await TenantContext.runForOrganization(organizationId.toString(), async () => {
      const roles = await this.roles.create(
        DEFAULT_ROLE_TEMPLATES.map((t) => ({
          name: t.name,
          description: t.description,
          templateKey: t.key,
          isLocked: t.key === OWNER_ROLE_KEY,
          permissions: t.permissions,
        })),
        { session, ordered: true },
      );
      const ownerRole = roles.find((r) => r.templateKey === OWNER_ROLE_KEY)!;

      const [branch] = await this.branches.create([{ name: 'Principal', timezone }], { session });

      const [created] = await this.memberships.create(
        [{ userId: ownerUserId, roleIds: [ownerRole._id], status: 'active' }],
        { session },
      );
      if (input.ownerAttends) {
        const owner = await this.users.findById(ownerUserId).select('firstName lastName').session(session).exec();
        await this.professionals.create(
          [
            {
              displayName: owner ? `${owner.firstName} ${owner.lastName}`.trim() : 'Dueño',
              branchIds: [branch!._id],
              membershipId: created!._id,
            },
          ],
          { session },
        );
      }
      return created;
    });

    await this.subscriptions.startTrial(organizationId.toString(), input.planCode, session);
    await this.audit.log(
      {
        action: 'organization.created',
        entityType: 'Organization',
        entityId: organizationId.toString(),
        organizationId: organizationId.toString(),
        actorUserId: ownerUserId,
        metadata: { name: input.name, planCode: input.planCode },
      },
      session,
    );

    return { organization, membership };
  }

  async getCurrent(): Promise<OrganizationDocument> {
    const org = await this.organizations.findById(TenantContext.requireOrganizationId()).exec();
    if (!org) throw Errors.notFound('Negocio');
    return org;
  }

  async updateCurrent(input: UpdateOrganizationDto): Promise<OrganizationDocument> {
    const org = await this.getCurrent();
    if (input.slug && input.slug !== org.slug) {
      if (await this.organizations.exists({ slug: input.slug })) {
        throw Errors.conflict('SLUG_TAKEN', 'Esa dirección ya está en uso');
      }
    }
    org.set(input);
    await org.save();
    await this.audit.log({
      action: 'organization.updated',
      entityType: 'Organization',
      entityId: org.id as string,
      metadata: { fields: Object.keys(input) },
    });
    return org;
  }

  findByIds(ids: string[]): Promise<OrganizationDocument[]> {
    return this.organizations.find({ _id: { $in: ids } }).exec();
  }

  async setStatus(organizationId: string, status: 'active' | 'suspended'): Promise<OrganizationDocument> {
    const org = await this.organizations
      .findByIdAndUpdate(organizationId, { status }, { new: true })
      .exec();
    if (!org) throw Errors.notFound('Negocio');
    this.entitlements.invalidate(organizationId);
    await this.audit.log({
      action: status === 'suspended' ? 'organization.suspended' : 'organization.reactivated',
      entityType: 'Organization',
      entityId: organizationId,
      organizationId,
    });
    return org;
  }

  async listForPlatform(page = 1, pageSize = 25, search?: string) {
    const filter = search
      ? { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
      : {};
    const [items, total] = await Promise.all([
      this.organizations
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.organizations.countDocuments(filter).exec(),
    ]);
    return { items, total, page, pageSize };
  }

  private async availableSlug(base: string, session: ClientSession): Promise<string> {
    let slug = base;
    while (await this.organizations.exists({ slug }).session(session)) {
      slug = `${base}-${randomBytes(2).toString('hex')}`;
    }
    return slug;
  }
}
