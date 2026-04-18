import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import { ThemeToggle } from '../components/ThemeToggle'
import {
  PLANS, PLAN_MAP, isSubActive, subStatusLabel, subStatusColor,
  type Plan,
} from '../lib/plans'
import type { OrgBilling } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgOption {
  id:   string
  name: string
  role: 'owner' | 'member'
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  current,
  onSelect,
  loading,
}: {
  plan:     Plan
  current:  boolean
  onSelect: (planId: string) => void
  loading:  boolean
}) {
  return (
    <div className={`relative rounded-2xl border p-6 flex flex-col gap-4 transition-all ${
      plan.highlight
        ? 'border-primary/40 bg-primary/5 shadow-lg shadow-primary/10'
        : 'border-white/10 bg-white/3'
    } ${current ? 'ring-2 ring-primary/60' : ''}`}>

      {plan.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-white text-2xs font-black uppercase tracking-widest rounded-full">
          Most popular
        </span>
      )}

      <div>
        <span className={`inline-block px-2.5 py-1 text-2xs font-black uppercase tracking-widest rounded-lg border mb-3 ${plan.color} ${plan.bg} border-current/30`}>
          {plan.badge}
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-white">${plan.priceUsd}</span>
          <span className="text-slate-500 text-sm font-medium">/ month</span>
        </div>
      </div>

      {/* Feature framed as value, not as SMS */}
      <p className="text-sm font-semibold text-slate-300">
        Up to <span className="text-white font-extrabold">{plan.followUps.toLocaleString()}</span> automated follow-ups per month
      </p>

      <ul className="flex flex-col gap-2 flex-1">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2 text-xs text-slate-400">
            <span className="material-symbols-outlined text-emerald-400 text-base leading-none mt-0.5 flex-shrink-0">check_circle</span>
            {f}
          </li>
        ))}
      </ul>

      <button
        disabled={current || loading}
        onClick={() => onSelect(plan.id)}
        className={`w-full py-3 rounded-xl text-sm font-black uppercase tracking-spaced transition-all active:scale-95 ${
          current
            ? 'bg-white/5 text-slate-500 cursor-default border border-white/10'
            : plan.highlight
            ? 'bg-primary text-white hover:bg-primary/90 shadow-md shadow-primary/30'
            : 'bg-white/10 text-white hover:bg-white/15 border border-white/10'
        } ${loading ? 'opacity-50 cursor-wait' : ''}`}
      >
        {current ? 'Current plan' : loading ? 'Redirecting…' : 'Choose plan'}
      </button>
    </div>
  )
}

// ─── Usage bar ────────────────────────────────────────────────────────────────

function UsageBar({ used, total }: { used: number; total: number }) {
  const pct     = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const critical = pct >= 90
  const warning  = pct >= 70

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-400 font-medium">Automated follow-ups this cycle</span>
        <span className={`font-black ${critical ? 'text-red-400' : warning ? 'text-amber-400' : 'text-white'}`}>
          {used.toLocaleString()} <span className="text-slate-500 font-medium">of</span> {total.toLocaleString()}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            critical ? 'bg-red-500' : warning ? 'bg-amber-500' : 'bg-primary'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {critical && (
        <p className="text-2xs text-red-400 font-medium">
          Almost out — upgrade to avoid blocking future follow-ups.
        </p>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Billing() {
  const navigate   = useNavigate()
  const [params]   = useSearchParams()
  const { toast }  = useToast()
  useAuth() // required for protected route context

  const [orgs, setOrgs]         = useState<OrgOption[]>([])
  const [selectedOrg, setSelectedOrg] = useState<string | null>(params.get('org'))
  const [billing, setBilling]   = useState<OrgBilling | null>(null)
  const [loading, setLoading]   = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [monthlyUsed, setMonthlyUsed] = useState(0)

  // ── Load orgs the user owns (only owners can manage billing) ──────────────
  useEffect(() => {
    supabase
      .from('organization_members')
      .select('organization_id, role, organizations(id, name)')
      .eq('role', 'owner')
      .then(({ data }) => {
        const list: OrgOption[] = (data ?? []).map((row: {
          organization_id: string
          role: 'owner' | 'member'
          organizations: { id: string; name: string } | { id: string; name: string }[] | null
        }) => {
          const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
          return {
            id:   org?.id   ?? row.organization_id,
            name: org?.name ?? 'Unnamed org',
            role: row.role,
          }
        })
        setOrgs(list)
        if (!selectedOrg && list.length === 1) setSelectedOrg(list[0].id)
      })
  }, [selectedOrg])

  // ── Load billing data for selected org ────────────────────────────────────
  const loadBilling = useCallback(async (orgId: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_org_billing', { p_org_id: orgId })
      if (error) throw error
      setBilling(data as OrgBilling)

      // Count SMS sent events this cycle to show "used" count
      const resetAt = (data as OrgBilling)?.credits?.last_reset_at
      if (resetAt) {
        const { count } = await supabase
          .from('usage_events')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('event_type', 'sms_sent')
          .gte('created_at', resetAt)
        setMonthlyUsed(count ?? 0)
      }
    } catch (err) {
      console.error('loadBilling:', err)
      toast('Could not load billing details', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (selectedOrg) loadBilling(selectedOrg)
  }, [selectedOrg, loadBilling])

  // ── Handle return from Stripe Checkout ────────────────────────────────────
  useEffect(() => {
    const status = params.get('status')
    if (status === 'success') {
      toast('Subscription activated — your follow-ups are ready!', 'success')
      // Reload after a brief delay to let the webhook process
      setTimeout(() => { if (selectedOrg) loadBilling(selectedOrg) }, 2_000)
    } else if (status === 'canceled') {
      toast('Checkout cancelled — no charge was made.', 'info')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Trigger checkout ──────────────────────────────────────────────────────
  async function handleSelectPlan(planId: string) {
    if (!selectedOrg) return
    setCheckoutLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await supabase.functions.invoke('create-checkout-session', {
        body: { plan_id: planId, org_id: selectedOrg },
      })

      if (res.error) throw new Error(res.error.message)
      const { url } = res.data as { url: string }
      window.location.href = url
    } catch (err) {
      console.error('checkout error:', err)
      toast(String(err) || 'Failed to start checkout', 'error')
      setCheckoutLoading(false)
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const sub          = billing?.subscription
  const credits      = billing?.credits
  const currentPlan  = PLAN_MAP[sub?.plan_id ?? ''] ?? null
  const active       = isSubActive(sub?.status)
  const totalAllowed = credits ? (credits.balance + monthlyUsed) : (currentPlan?.followUps ?? 0)
  const periodEnd    = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-background-dark min-h-screen text-white antialiased font-display">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-background-dark/80 backdrop-blur-md border-b border-white/5 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-base font-extrabold uppercase tracking-tighter text-white leading-none">Billing</h1>
          <p className="text-2xs text-slate-500 font-medium mt-0.5">Manage your subscription</p>
        </div>
        <ThemeToggle />
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">

        {/* Org selector — only show if user owns multiple orgs */}
        {orgs.length > 1 && (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Organisation</label>
            <select
              value={selectedOrg ?? ''}
              onChange={e => setSelectedOrg(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 appearance-none max-w-xs"
            >
              <option value="" disabled>Select an organisation</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}

        {!selectedOrg && (
          <div className="text-center py-20 text-slate-500">
            <span className="material-symbols-outlined text-5xl mb-3 block">corporate_fare</span>
            <p className="text-sm font-medium">Select an organisation to manage billing</p>
          </div>
        )}

        {selectedOrg && loading && (
          <div className="flex items-center gap-3 text-slate-500 py-10">
            <div className="w-5 h-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
            <span className="text-sm">Loading billing details…</span>
          </div>
        )}

        {selectedOrg && !loading && (
          <>
            {/* ── Current plan status ────────────────────────────────────── */}
            <section className="rounded-2xl border border-white/10 bg-white/3 p-6 space-y-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Current plan</p>
                  <h2 className="text-2xl font-extrabold text-white">
                    {currentPlan ? currentPlan.name : 'No plan'}
                  </h2>
                  {periodEnd && (
                    <p className="text-xs text-slate-500 mt-1">
                      {sub?.cancel_at_period_end ? 'Cancels' : 'Renews'} {periodEnd}
                    </p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${subStatusColor(sub?.status)}`}>
                  {subStatusLabel(sub?.status)}
                </span>
              </div>

              {/* Usage bar — only shown when there's an active subscription */}
              {active && credits && (
                <UsageBar
                  used={monthlyUsed}
                  total={totalAllowed}
                />
              )}

              {/* Blocked state — no active sub */}
              {!active && sub && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="material-symbols-outlined text-amber-400 flex-shrink-0">warning</span>
                  <div>
                    <p className="text-sm font-bold text-amber-300">Automated follow-ups paused</p>
                    <p className="text-xs text-amber-400/80 mt-0.5">
                      {sub.status === 'past_due'
                        ? 'Your last payment failed. Update your payment method to restore follow-ups.'
                        : 'Resubscribe below to re-enable automated absence follow-ups for your members.'}
                    </p>
                  </div>
                </div>
              )}

              {/* No subscription at all */}
              {!sub && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <span className="material-symbols-outlined text-primary flex-shrink-0">info</span>
                  <div>
                    <p className="text-sm font-bold text-white">Start your free trial</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      14 days free, no charge until the trial ends. Cancel any time.
                    </p>
                  </div>
                </div>
              )}

              {/* Usage detail — for admin visibility */}
              {active && (
                <details className="group">
                  <summary className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer select-none font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm group-open:rotate-90 transition-transform">chevron_right</span>
                    Technical usage details
                  </summary>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Remaining credits', value: (credits?.balance ?? 0).toLocaleString() },
                      { label: 'Sent this cycle',   value: monthlyUsed.toLocaleString() },
                      { label: 'Plan allowance',     value: (currentPlan?.followUps ?? 0).toLocaleString() },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <p className="text-2xs text-slate-500 font-medium">{label}</p>
                        <p className="text-lg font-extrabold text-white mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>

            {/* ── Plan selector ──────────────────────────────────────────── */}
            <section>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">
                {active ? 'Change plan' : 'Choose a plan'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {PLANS.map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    current={sub?.plan_id === plan.id && active}
                    onSelect={handleSelectPlan}
                    loading={checkoutLoading}
                  />
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-600 text-center">
                All plans include a 14-day free trial on first subscription · Cancel any time · No hidden fees
              </p>
            </section>

            {/* ── Manage existing subscription (Stripe portal) ───────────── */}
            {sub?.stripe_customer_id && (
              <section className="rounded-2xl border border-white/10 bg-white/3 p-6 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-white">Payment & invoices</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Update card details, download invoices, or cancel your subscription.
                  </p>
                </div>
                <button
                  onClick={() => handleSelectPlan(sub?.plan_id ?? 'starter')}
                  disabled={checkoutLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-bold text-white transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">open_in_new</span>
                  Manage billing
                </button>
              </section>
            )}

            {/* ── What's included explainer ──────────────────────────────── */}
            <section className="rounded-2xl border border-white/10 bg-white/3 p-6">
              <h3 className="text-sm font-extrabold text-white mb-4">What are automated follow-ups?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                When a member misses a session, Rollcally automatically sends them a personalised
                message — no manual work needed. You set the message template, timing, and consent
                rules. Your allowance is the number of these messages you can send per billing cycle.
              </p>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                Messages are only sent to members who have explicitly consented. Your allowance resets
                at the start of each billing cycle, and unused follow-ups do not roll over.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
