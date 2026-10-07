import type { MailMessage } from './mail.service.js';

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Diseño común: logo, título, párrafos y un botón. Estilos en línea para clientes de correo. */
function layout(opts: { title: string; paragraphs: string[]; cta?: { label: string; url: string }; footer?: string }): string {
  const body = opts.paragraphs
    .map((p) => (p.startsWith('<table') ? p : `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#33365A">${p}</p>`))
    .join('');
  const button = opts.cta
    ? `<p style="margin:24px 0"><a href="${escape(opts.cta.url)}" style="display:inline-block;background:#3F4497;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">${escape(opts.cta.label)}</a></p>
       <p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:#7A7D99">Si el botón no funciona, copia este enlace en tu navegador:<br><a href="${escape(opts.cta.url)}" style="color:#2F7C8C;word-break:break-all">${escape(opts.cta.url)}</a></p>`
    : '';
  return `<!doctype html><html lang="es"><body style="margin:0;background:#F3F4F9;font-family:Montserrat,Segoe UI,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;padding:32px">
      <tr><td>
        <div style="font-size:22px;font-weight:700;color:#3F4497;margin-bottom:24px">u<span style="color:#2F9AAE">Book</span></div>
        <h1 style="margin:0 0 16px;font-size:20px;color:#1F2245">${escape(opts.title)}</h1>
        ${body}${button}
        ${opts.footer ? `<p style="margin:24px 0 0;font-size:12px;color:#7A7D99">${opts.footer}</p>` : ''}
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export function invitationEmail(opts: {
  to: string;
  firstName: string;
  organizationName: string;
  inviterName: string;
  roleName: string;
  url: string;
  expiresAt: Date;
}): MailMessage {
  const until = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', timeZone: 'America/Lima' }).format(opts.expiresAt);
  const subject = `${opts.inviterName} te invitó a ${opts.organizationName} en uBook`;
  return {
    to: opts.to,
    subject,
    html: layout({
      title: `Hola ${opts.firstName}, te invitaron a ${opts.organizationName}`,
      paragraphs: [
        `<b>${escape(opts.inviterName)}</b> te agregó al equipo de <b>${escape(opts.organizationName)}</b> como <b>${escape(opts.roleName)}</b>.`,
        'Con uBook verás tu agenda, tus citas y tus clientes desde el celular o la computadora.',
      ],
      cta: { label: 'Aceptar invitación', url: opts.url },
      footer: `La invitación vence el ${until}. Si no esperabas este correo, puedes ignorarlo.`,
    }),
    text: [
      `Hola ${opts.firstName},`,
      '',
      `${opts.inviterName} te agregó al equipo de ${opts.organizationName} en uBook como ${opts.roleName}.`,
      '',
      `Acepta la invitación aquí: ${opts.url}`,
      '',
      `La invitación vence el ${until}. Si no esperabas este correo, puedes ignorarlo.`,
    ].join('\n'),
  };
}

export type BookingEmailKind = 'confirmed' | 'pending' | 'approved' | 'cancelled' | 'cancelled_by_business' | 'rescheduled' | 'reminder';

export interface BookingEmailDetails {
  to: string;
  firstName: string;
  organizationName: string;
  serviceName: string;
  professionalName: string;
  branchName: string;
  branchAddress?: string;
  startsAt: Date;
  timezone: string;
  number: number;
  /** Enlace para ver, cancelar o reprogramar. */
  manageUrl: string;
  /** Página para reservar de nuevo (correos de cancelación). */
  bookingUrl: string;
}

const BOOKING_COPY: Record<BookingEmailKind, { subject: string; title: string; intro: string; cta: 'manage' | 'book' | null }> = {
  confirmed: { subject: 'Tu cita está confirmada', title: '¡Tu cita está confirmada!', intro: 'Te esperamos. Estos son los detalles:', cta: 'manage' },
  pending: {
    subject: 'Recibimos tu reserva',
    title: 'Recibimos tu reserva',
    intro: 'El negocio la revisará y te avisaremos por correo apenas la confirme.',
    cta: 'manage',
  },
  approved: { subject: 'Tu cita fue confirmada', title: '¡Tu cita fue confirmada!', intro: 'El negocio aprobó tu reserva. Te esperamos:', cta: 'manage' },
  cancelled: { subject: 'Cancelaste tu cita', title: 'Tu cita fue cancelada', intro: 'Cancelamos esta cita como pediste:', cta: 'book' },
  cancelled_by_business: {
    subject: 'Tu cita fue cancelada',
    title: 'Tu cita fue cancelada',
    intro: 'El negocio canceló esta cita. Si quieres, puedes reservar otro horario:',
    cta: 'book',
  },
  rescheduled: { subject: 'Cambiaste el horario de tu cita', title: 'Tu cita tiene nuevo horario', intro: 'Estos son los nuevos detalles:', cta: 'manage' },
  reminder: { subject: 'Recordatorio: tu cita es mañana', title: 'Tu cita es mañana', intro: 'Te recordamos tu cita:', cta: 'manage' },
};

export function bookingEmail(kind: BookingEmailKind, d: BookingEmailDetails): MailMessage {
  const copy = BOOKING_COPY[kind];
  const when = new Intl.DateTimeFormat('es-PE', {
    timeZone: d.timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d.startsAt);
  const rows: Array<[string, string]> = [
    ['Cuándo', when],
    ['Servicio', d.serviceName],
    ['Con', d.professionalName],
    ['Dónde', [d.branchName, d.branchAddress].filter(Boolean).join(' · ')],
  ];
  const table = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:4px 0 8px;border-collapse:collapse">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:#7A7D99;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0;font-size:14px;color:#1F2245;font-weight:600">${escape(v)}</td></tr>`,
    )
    .join('')}</table>`;
  const cta =
    copy.cta === 'manage'
      ? { label: 'Ver, cambiar o cancelar', url: d.manageUrl }
      : copy.cta === 'book'
        ? { label: 'Reservar otro horario', url: d.bookingUrl }
        : undefined;
  const subject = `${copy.subject} · ${d.organizationName}`;
  return {
    to: d.to,
    subject,
    html: layout({
      title: `${copy.title}`,
      paragraphs: [`Hola ${escape(d.firstName)}:`, copy.intro, table],
      cta,
      footer: `${escape(d.organizationName)} · Cita #UB-${d.number}. Reservado con uBook.`,
    }),
    text: [
      `Hola ${d.firstName}:`,
      '',
      copy.intro,
      '',
      ...rows.map(([k, v]) => `${k}: ${v}`),
      '',
      cta ? `${cta.label}: ${cta.url}` : '',
      '',
      `${d.organizationName} · Cita #UB-${d.number}`,
    ].join('\n'),
  };
}

/** Aviso a quien está en lista de espera: hay horarios libres. */
export function waitlistEmail(d: {
  to: string;
  firstName: string;
  organizationName: string;
  serviceName: string;
  options: string[];
  bookingUrl: string;
}): MailMessage {
  const list = d.options.map((o) => `• ${escape(o)}`).join('<br>');
  return {
    to: d.to,
    subject: `Se liberó un horario para ${d.serviceName} · ${d.organizationName}`,
    html: layout({
      title: 'Se liberó un horario',
      paragraphs: [
        `Hola ${escape(d.firstName)}:`,
        `Estabas en la lista de espera de <b>${escape(d.organizationName)}</b> para <b>${escape(d.serviceName)}</b>. Ahora hay espacio:`,
        list,
        'Los horarios se asignan por orden de reserva.',
      ],
      cta: { label: 'Reservar ahora', url: d.bookingUrl },
    }),
    text: [
      `Hola ${d.firstName}:`,
      '',
      `Estabas en la lista de espera de ${d.organizationName} para ${d.serviceName}. Ahora hay espacio:`,
      ...d.options.map((o) => `- ${o}`),
      '',
      `Reserva aquí: ${d.bookingUrl}`,
    ].join('\n'),
  };
}
