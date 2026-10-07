import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Env } from '../../config/env.js';
import { TenantContext } from '../../core/tenancy/tenant-context.js';
import { BookingMailerService } from './booking-mailer.service.js';
import { Appointment } from './schemas/appointment.schema.js';

const HOUR = 3_600_000;
const EVERY = 5 * 60_000;

/**
 * Recordatorio por correo el día antes. Cada 5 minutos busca citas que
 * empiezan en las próximas 24 h. Marcar antes de enviar evita duplicados
 * aunque corran varias instancias de la API.
 */
@Injectable()
export class BookingRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Recordatorios');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    private readonly mailer: BookingMailerService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    this.timer = setInterval(() => void this.run().catch((e: Error) => this.logger.error(e.message)), EVERY);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Citas confirmadas que empiezan entre 2 y 24 h desde ahora, reservadas con
   * al menos 12 h de anticipación (a quien reservó para hoy no le sirve).
   */
  async run(now = new Date()): Promise<number> {
    const due = await TenantContext.runAsSystem(() =>
      this.appointments
        .find({
          status: 'confirmed',
          reminderSentAt: null,
          startsAt: { $gt: new Date(now.getTime() + 2 * HOUR), $lte: new Date(now.getTime() + 24 * HOUR) },
        })
        .select('organizationId startsAt createdAt')
        .limit(500)
        .exec(),
    );
    let sent = 0;
    for (const appt of due) {
      const createdAt = (appt as unknown as { createdAt: Date }).createdAt;
      const claimed = await TenantContext.runAsSystem(() =>
        this.appointments.updateOne({ _id: appt._id, reminderSentAt: null }, { reminderSentAt: now }).exec(),
      );
      if (claimed.modifiedCount === 0) continue;
      if (appt.startsAt.getTime() - createdAt.getTime() < 12 * HOUR) continue;
      const ok = await TenantContext.runForOrganization(appt.organizationId.toString(), () =>
        this.mailer.notify('reminder', appt.id as string),
      );
      if (ok) sent += 1;
    }
    if (sent) this.logger.log(`${sent} recordatorios enviados`);
    return sent;
  }
}
