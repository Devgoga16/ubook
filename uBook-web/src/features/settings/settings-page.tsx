import { Card } from '@/components/ui/card'
import { RouteTabs, useTab } from '@/components/ui/page'
import { BillingSection } from '@/features/billing/billing-section'
import { TemplatesSection } from '@/features/records/templates-section'
import { useAccess } from '@/lib/auth/access'

type Tab = 'plan' | 'fichas'

/** Ajustes / Configuración: plan y pagos (Dueño) y plantillas de fichas clínicas. */
export function SettingsPage() {
  const { can, hasFeature } = useAccess()
  const canBill = can('subscription.manage')
  const allowed: Tab[] = canBill ? ['plan', 'fichas'] : ['fichas']
  const tab = useTab<Tab>(allowed, allowed[0]!)

  return (
    <>
      <RouteTabs<Tab>
        fallback={allowed[0]!}
        tabs={[...(canBill ? [{ value: 'plan' as const, label: 'Plan y pagos' }] : []), { value: 'fichas', label: 'Fichas clínicas' }]}
      />
      {tab === 'plan' && <BillingSection />}
      {tab === 'fichas' &&
        (hasFeature('client_records') ? (
          <TemplatesSection />
        ) : (
          <Card>
            <p className="m-0 text-sm text-muted">Tu plan no incluye fichas clínicas.</p>
          </Card>
        ))}
    </>
  )
}
