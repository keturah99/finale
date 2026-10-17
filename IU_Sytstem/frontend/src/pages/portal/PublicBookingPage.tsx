import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import {
  Truck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Package,
  Calendar,
  User as UserIcon,
  Phone,
  Mail,
  MessageSquare,
} from 'lucide-react'

import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { BookingFormData } from '@/types/transport'

const schema = z.object({
  pickup_location: z.string().min(1, 'Pickup location is required').max(200),
  delivery_location: z.string().min(1, 'Delivery location is required').max(200),
  cargo_description: z.string().min(1, 'Tell us what you need moved'),
  cargo_weight_kg: z
    .string()
    .min(1, 'Weight is required')
    .refine((v) => Number(v) > 0, 'Weight must be greater than zero'),
  cargo_category: z.enum(['general', 'dg', 'bulk']),
  pickup_date: z.string().min(1, 'Pickup date is required'),
  delivery_date: z.string().optional(),
  customer_name: z.string().min(1, 'Name is required').max(150),
  customer_phone: z.string().min(1, 'Phone number is required').max(20),
  customer_email: z.string().email('Invalid email').or(z.literal('')).optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const STEPS = [
  { id: 0, label: 'Route & Cargo', icon: Truck },
  { id: 1, label: 'Schedule', icon: Calendar },
  { id: 2, label: 'Contact & Review', icon: UserIcon },
] as const

const STEP_FIELDS: (keyof FormValues)[][] = [
  ['pickup_location', 'delivery_location', 'cargo_description', 'cargo_weight_kg', 'cargo_category'],
  ['pickup_date', 'delivery_date'],
  ['customer_name', 'customer_phone', 'customer_email', 'notes'],
]

export function PublicBookingPage() {
  const [step, setStep] = useState(0)
  const [createdRef, setCreatedRef] = useState<number | null>(null)
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      pickup_location: '',
      delivery_location: '',
      cargo_description: '',
      cargo_weight_kg: '',
      cargo_category: 'general',
      pickup_date: today,
      delivery_date: '',
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      notes: '',
    },
  })

  const submit = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: BookingFormData = {
        customer_name: values.customer_name,
        customer_phone: values.customer_phone,
        customer_email: values.customer_email || '',
        pickup_location: values.pickup_location,
        delivery_location: values.delivery_location,
        cargo_description: values.cargo_description,
        cargo_weight_kg: values.cargo_weight_kg,
        cargo_category: values.cargo_category,
        pickup_date: values.pickup_date,
        delivery_date: values.delivery_date || null,
        notes: values.notes || '',
      }
      const { data } = await api.post('/api/transport/bookings/', payload)
      return data as { id: number }
    },
    onSuccess: (data) => setCreatedRef(data.id),
  })

  const handleNext = async () => {
    const valid = await form.trigger(STEP_FIELDS[step])
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const handleBack = () => setStep((s) => Math.max(s - 1, 0))
  const handleSubmit = form.handleSubmit((values) => submit.mutate(values))

  if (createdRef !== null) {
    return (
      <PortalLayout>
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Booking received
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300 dark:text-slate-400">
            Thank you. Our team will call you within 24 hours to confirm details and pricing.
          </p>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Your reference number
            </p>
            <p className="mt-1 font-mono text-3xl font-bold text-brand-600 dark:text-brand-400">
              #{createdRef}
            </p>
          </div>

          <div className="mt-8">
            <Button
              variant="outline"
              onClick={() => {
                setCreatedRef(null)
                setStep(0)
                form.reset()
              }}
            >
              Book another
            </Button>
          </div>
        </div>
      </PortalLayout>
    )
  }

  const values = form.watch()

  return (
    <PortalLayout>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Book transport
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Tell us what you need moved and we'll get back to you.
        </p>
      </div>

      <div className="mb-8 flex items-center justify-between">
        {STEPS.map((s, idx) => {
          const Icon = s.icon
          const isActive = step === idx
          const isDone = step > idx
          return (
            <div key={s.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition',
                    isDone
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : isActive
                        ? 'border-brand-500 bg-white text-brand-600 dark:bg-slate-900 dark:text-brand-400'
                        : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500',
                  )}
                >
                  {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                </div>
                <p
                  className={cn(
                    'mt-2 hidden text-xs font-medium sm:block',
                    isActive || isDone
                      ? 'text-slate-800 dark:text-slate-100 dark:text-slate-200'
                      : 'text-slate-400 dark:text-slate-500',
                  )}
                >
                  {s.label}
                </p>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 flex-1 transition',
                    step > idx ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {step === 0 && <StepRouteCargo form={form} />}
        {step === 1 && <StepSchedule form={form} />}
        {step === 2 && <StepContactReview form={form} values={values} />}

        <div className="flex items-center justify-between pt-4">
          <Button type="button" variant="ghost" onClick={handleBack} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={handleNext}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending ? 'Submitting…' : 'Submit Booking'}
            </Button>
          )}
        </div>

        {submit.isError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
            Something went wrong. Please try again or call us directly.
          </div>
        )}
      </form>
    </PortalLayout>
  )
}

function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10 dark:from-slate-950 dark:to-slate-900 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-white">
            <Truck className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Integrated Unified System
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          Need help? Call us on 0977 000 000
        </p>
      </div>
    </div>
  )
}

function StepRouteCargo({ form }: { form: ReturnType<typeof useForm<FormValues>> }) {
  const { register, formState: { errors } } = form
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Pickup location" icon={MapPin} error={errors.pickup_location?.message} required>
          <Input placeholder="e.g. Lusaka Industrial Area" error={Boolean(errors.pickup_location)} {...register('pickup_location')} />
        </Field>
        <Field label="Delivery location" icon={MapPin} error={errors.delivery_location?.message} required>
          <Input placeholder="e.g. Kitwe CBD" error={Boolean(errors.delivery_location)} {...register('delivery_location')} />
        </Field>
      </div>
      <Field label="What are we moving?" icon={Package} error={errors.cargo_description?.message} required>
        <Textarea placeholder="e.g. 50 bags of cement and 20 roofing sheets" rows={3} error={Boolean(errors.cargo_description)} {...register('cargo_description')} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Approximate weight (kg)" error={errors.cargo_weight_kg?.message} required>
          <Input type="text" inputMode="decimal" placeholder="e.g. 4500" error={Boolean(errors.cargo_weight_kg)} {...register('cargo_weight_kg', { setValueAs: (v) => String(v).replace(/[^\d.]/g, '') })} />
        </Field>
        <Field label="Type of goods" error={errors.cargo_category?.message} required>
          <Select error={Boolean(errors.cargo_category)} {...register('cargo_category')}>
            <option value="general">General goods</option>
            <option value="bulk">Bulk materials</option>
            <option value="dg">Dangerous goods</option>
          </Select>
        </Field>
      </div>
    </div>
  )
}

function StepSchedule({ form }: { form: ReturnType<typeof useForm<FormValues>> }) {
  const { register, formState: { errors } } = form
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Pickup date" icon={Calendar} error={errors.pickup_date?.message} required>
          <Input type="date" error={Boolean(errors.pickup_date)} {...register('pickup_date')} />
        </Field>
        <Field label="Delivery date (optional)" icon={Calendar} error={errors.delivery_date?.message}>
          <Input type="date" error={Boolean(errors.delivery_date)} {...register('delivery_date')} />
        </Field>
      </div>
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400">
        <p>Dates are flexible. Our dispatcher will confirm the exact schedule when we call you.</p>
      </div>
    </div>
  )
}

function StepContactReview({
  form, values,
}: {
  form: ReturnType<typeof useForm<FormValues>>
  values: FormValues
}) {
  const { register, formState: { errors } } = form
  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Your contact details
        </h3>
        <div className="space-y-4">
          <Field label="Full name" icon={UserIcon} error={errors.customer_name?.message} required>
            <Input placeholder="e.g. Peter Zulu" error={Boolean(errors.customer_name)} {...register('customer_name')} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone number" icon={Phone} error={errors.customer_phone?.message} required>
              <Input type="tel" placeholder="e.g. 0977 333 444" error={Boolean(errors.customer_phone)} {...register('customer_phone')} />
            </Field>
            <Field label="Email (optional)" icon={Mail} error={errors.customer_email?.message}>
              <Input type="email" placeholder="you@example.com" error={Boolean(errors.customer_email)} {...register('customer_email')} />
            </Field>
          </div>
          <Field label="Additional notes (optional)" icon={MessageSquare} error={errors.notes?.message}>
            <Textarea placeholder="Anything else we should know?" rows={2} {...register('notes')} />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Review your booking
        </h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 bg-slate-50 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800/50">
          <SummaryRow label="From" value={values.pickup_location || '—'} />
          <SummaryRow label="To" value={values.delivery_location || '—'} />
          <SummaryRow label="Cargo" value={values.cargo_description || '—'} />
          <SummaryRow
            label="Weight"
            value={values.cargo_weight_kg ? `${Number(values.cargo_weight_kg).toLocaleString()} kg` : '—'}
          />
          <SummaryRow
            label="Type"
            value={
              values.cargo_category === 'dg' ? 'Dangerous goods'
                : values.cargo_category === 'bulk' ? 'Bulk materials'
                : 'General goods'
            }
          />
          <SummaryRow label="Pickup date" value={values.pickup_date || '—'} />
          {values.delivery_date && (
            <SummaryRow label="Delivery date" value={values.delivery_date} />
          )}
        </div>
      </div>
    </div>
  )
}

function Field({
  label, icon: Icon, error, required, children,
}: {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <Label required={required} className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />}
        {label}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
      <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right text-slate-800 dark:text-slate-100 dark:text-slate-200">{value}</span>
    </div>
  )
}