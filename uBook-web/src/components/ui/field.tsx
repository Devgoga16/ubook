import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

const control =
  'w-full min-w-0 rounded-control border border-line-strong bg-surface px-2.5 py-2 text-body text-ink placeholder:text-muted ' +
  'aria-[invalid=true]:border-bad disabled:opacity-60'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-16 resize-y', className)} {...props} />
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(control, 'cursor-pointer', className)} {...props} />
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('text-2xs font-semibold text-muted', className)} {...props} />
}

/**
 * Campo con etiqueta, ayuda y error. El control recibe `id`, `aria-invalid`
 * y `aria-describedby` a través de la función hija.
 */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string
  hint?: string
  error?: string
  className?: string
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode
}) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={cn('flex min-w-0 flex-col gap-[5px]', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <span id={`${id}-error`} className="text-2xs font-semibold text-bad">
          {error}
        </span>
      ) : (
        hint && (
          <span id={`${id}-hint`} className="text-2xs text-muted">
            {hint}
          </span>
        )
      )}
    </div>
  )
}
