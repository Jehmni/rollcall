/**
 * Static plan configuration — single source of truth for the frontend.
 * Kept in sync with the pricing_plans table (seeded in 20260406_billing.sql)
 * and the PLAN_CREDITS map in the stripe-webhook edge function.
 *
 * UI language deliberately avoids "SMS" — we sell automated follow-ups,
 * not messages. The technical details live in the billing page internals only.
 */

export interface Plan {
  id:               'starter' | 'growth' | 'pro'
  name:             string
  priceUsd:         number    // monthly, in USD
  followUps:        number    // automated follow-ups included per cycle
  badge:            string    // short label for the plan chip in the UI
  color:            string    // Tailwind colour token (text + border)
  bg:               string    // Tailwind bg token
  highlight:        boolean   // show as "most popular"
  features:         string[]
}

export const PLANS: Plan[] = [
  {
    id:        'starter',
    name:      'Starter',
    priceUsd:  25,
    followUps: 200,
    badge:     'Starter',
    color:     'text-slate-300',
    bg:        'bg-white/5',
    highlight: false,
    features: [
      '200 automated follow-ups / month',
      'Extra follow-ups at $0.18 each',
      'Per-unit sender identity',
      'Delivery log & consent management',
    ],
  },
  {
    id:        'growth',
    name:      'Growth',
    priceUsd:  59,
    followUps: 600,
    badge:     'Growth',
    color:     'text-primary',
    bg:        'bg-primary/10',
    highlight: true,
    features: [
      '600 automated follow-ups / month',
      'Extra follow-ups at $0.15 each',
      'Per-unit sender identity',
      'Delivery log & consent management',
      'Cooldown controls',
    ],
  },
  {
    id:        'pro',
    name:      'Pro',
    priceUsd:  119,
    followUps: 1_500,
    badge:     'Pro',
    color:     'text-amber-400',
    bg:        'bg-amber-500/10',
    highlight: false,
    features: [
      '1,500 automated follow-ups / month',
      'Extra follow-ups at $0.12 each',
      'Per-unit sender identity',
      'Delivery log & consent management',
      'Cooldown controls',
      'Priority support',
    ],
  },
]

export const PLAN_MAP = Object.fromEntries(PLANS.map(p => [p.id, p])) as Record<string, Plan>

/** True when a Stripe subscription status permits SMS sending. */
export function isSubActive(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing'
}

/** Human-readable status label for the billing page. */
export function subStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'active':             return 'Active'
    case 'trialing':           return 'Free trial'
    case 'past_due':           return 'Payment overdue'
    case 'canceled':           return 'Canceled'
    case 'incomplete':         return 'Incomplete'
    case 'incomplete_expired': return 'Expired'
    case 'unpaid':             return 'Unpaid'
    default:                   return 'No subscription'
  }
}

/** Tailwind colour classes for each status. */
export function subStatusColor(status: string | null | undefined): string {
  switch (status) {
    case 'active':    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    case 'trialing':  return 'text-sky-400 bg-sky-500/10 border-sky-500/30'
    case 'past_due':
    case 'unpaid':    return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    case 'canceled':
    case 'incomplete_expired': return 'text-red-400 bg-red-500/10 border-red-500/30'
    default:          return 'text-slate-400 bg-white/5 border-white/10'
  }
}
