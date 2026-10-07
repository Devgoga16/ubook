import { Check, CircleAlert, Copy, ExternalLink, MessageCircle, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { useProfessionals } from '@/features/professionals/api'
import { summarizeSchedule } from '@/features/professionals/schedule-summary'
import { useServices } from '@/features/services/api'
import { useAuth } from '@/lib/auth/auth-context'
import { cn } from '@/lib/cn'

function ChecklistItem({ ok, children, to, action }: { ok: boolean; children: React.ReactNode; to?: string; action?: string }) {
  return (
    <li className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
      <span className={cn('grid size-7 flex-none place-items-center rounded-full', ok ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn')}>
        {ok ? <Check size={15} aria-hidden /> : <CircleAlert size={15} aria-hidden />}
      </span>
      <span className="flex-1 text-sm">{children}</span>
      {!ok && to && (
        <Link to={to} className="text-xs font-semibold text-brand hover:underline">
          {action}
        </Link>
      )}
    </li>
  )
}

/** Negocio / Página de reservas: el enlace para compartir y qué falta para recibir reservas. */
export function BookingSettingsPage() {
  const { me } = useAuth()
  const services = useServices()
  const professionals = useProfessionals()
  const [copied, setCopied] = useState(false)

  const slug = me?.organization?.slug ?? ''
  const url = `${window.location.origin}/reservar/${slug}`
  const online = (services.data ?? []).filter((s) => !s.isArchived && s.onlineBooking)
  const ready = (professionals.data ?? []).filter(
    (p) => p.isActive && summarizeSchedule(p.schedules).days > 0 && p.services.some((x) => online.some((s) => s.id === x.serviceId)),
  )
  const share = `https://wa.me/?text=${encodeURIComponent(`Reserva tu cita en ${me?.organization?.name ?? 'nuestro negocio'}: ${url}`)}`

  const copy = async () => {
    await navigator.clipboard?.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <Card className="flex flex-col gap-4">
        <CardHeader title="Tu enlace de reservas" className="mb-0" />
        <p className="m-0 text-sm text-muted">
          Compártelo en tu Instagram, WhatsApp o Google. Tus clientes eligen servicio, profesional y horario, sin crear cuenta.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={url} aria-label="Enlace de reservas" onFocus={(e) => e.target.select()} />
          <Button onClick={copy}>
            {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-control bg-grad px-3.5 py-2 text-sm font-semibold"
          >
            <ExternalLink size={14} aria-hidden /> Ver mi página
          </a>
          <a
            href={share}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-control border border-line-strong bg-surface px-3.5 py-2 text-sm font-semibold text-ink-2 hover:border-teal"
          >
            <MessageCircle size={14} aria-hidden /> Compartir por WhatsApp
          </a>
        </div>
      </Card>

      <Card>
        <CardHeader title="Para recibir reservas" />
        <ul className="m-0 list-none p-0">
          <ChecklistItem ok={online.length > 0} to="/servicios" action="Ir a Servicios">
            {online.length > 0
              ? `${online.length} ${online.length === 1 ? 'servicio se puede' : 'servicios se pueden'} reservar online`
              : 'Ningún servicio tiene activada la reserva online'}
          </ChecklistItem>
          <ChecklistItem ok={ready.length > 0} to="/profesionales" action="Ir a Profesionales">
            {ready.length > 0
              ? `${ready.length} ${ready.length === 1 ? 'profesional tiene' : 'profesionales tienen'} horario y servicios online`
              : 'Ningún profesional tiene horario y servicios online'}
          </ChecklistItem>
        </ul>
      </Card>

      <Card className="flex flex-wrap items-center gap-3">
        <Settings2 size={20} className="text-brand" aria-hidden />
        <p className="m-0 flex-1 text-sm text-muted">
          Anticipación mínima, hasta cuándo se puede reservar, aprobación manual y cambios permitidos se configuran en Disponibilidad.
        </p>
        <Link to="/disponibilidad" className="text-sm font-semibold text-brand hover:underline">
          Reglas de reserva
        </Link>
      </Card>
    </>
  )
}
