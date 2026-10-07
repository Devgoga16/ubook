import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { FeatureKey, FeatureValue, Plan } from '@/lib/api/types'

function limitText(value: FeatureValue, one: string, many: (n: number) => string, unlimited: string) {
  if (value === null) return unlimited
  return value === 1 ? one : many(Number(value))
}

/** Funcionalidades que diferencian a los planes, en orden de importancia. */
const HIGHLIGHTS: Array<[FeatureKey, string]> = [
  ['client_records', 'Fichas clínicas'],
  ['client_portal', 'Portal del cliente'],
  ['guardians', 'Responsables y beneficiarios'],
  ['resources', 'Recursos (salas, equipos)'],
  ['custom_roles', 'Roles personalizados'],
  ['branch_reports', 'Reportes por sucursal'],
  ['audit_log', 'Registro de auditoría'],
  ['white_label', 'Sin marca uBook'],
]

export function planHighlights(plan: Plan): string[] {
  const f = plan.features
  return [
    limitText(f.max_professionals, '1 profesional', (n) => `Hasta ${n} profesionales`, 'Profesionales ilimitados'),
    limitText(f.max_branches, '1 sede', (n) => `Hasta ${n} sedes`, 'Sedes ilimitadas'),
    limitText(f.max_bookings_per_month, '1 reserva al mes', (n) => `${n} reservas al mes`, 'Reservas ilimitadas'),
    ...HIGHLIGHTS.filter(([key]) => f[key] === true).map(([, label]) => label),
  ]
}

export const plansQueryKey = ['plans'] as const

export function usePlans() {
  return useQuery({ queryKey: plansQueryKey, queryFn: () => api<Plan[]>('/plans'), staleTime: 5 * 60_000 })
}

const usd = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 })

/** 8900 (centavos) → "US$ 89", como en el prototipo. */
export function formatUsd(cents: number): string {
  return `US$ ${usd.format(cents / 100)}`
}
