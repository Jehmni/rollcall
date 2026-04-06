/**
 * stripe-webhook — Rollcally Edge Function
 *
 * Syncs Stripe subscription lifecycle events into the local subscriptions
 * and sms_credits tables. This is the only place that grants or revokes
 * SMS follow-up access — the send-absence-sms function trusts these tables.
 *
 * Required secrets:
 *   STRIPE_SECRET_KEY          Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET      Webhook signing secret (whsec_...)
 *
 * Stripe events handled:
 *   checkout.session.completed    → create subscription row + top up credits
 *   invoice.paid                  → reset credits for new billing cycle
 *   customer.subscription.updated → sync status, plan, period
 *   customer.subscription.deleted → mark canceled, zero out credits
 *
 * Idempotency: all upserts use ON CONFLICT — safe to replay events.
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

// Plan ID → credits included. Kept in sync with pricing_plans table seed.
// Overage rates (enforced in application layer):
//   starter: $0.18/extra   growth: $0.15/extra   pro: $0.12/extra
const PLAN_CREDITS: Record<string, number> = {
  starter:  200,
  growth:   600,
  pro:    1_500,
}

function creditsForPlan(planId: string): number {
  return PLAN_CREDITS[planId] ?? 250
}

/**
 * Resolve Rollcally plan_id from a Stripe price ID.
 * Reads the price ID env vars set during Stripe product setup.
 *   STRIPE_PRICE_STARTER, STRIPE_PRICE_GROWTH, STRIPE_PRICE_PRO
 */
function planIdFromPriceId(priceId: string): string {
  if (priceId === Deno.env.get('STRIPE_PRICE_PRO'))     return 'pro'
  if (priceId === Deno.env.get('STRIPE_PRICE_GROWTH'))  return 'growth'
  if (priceId === Deno.env.get('STRIPE_PRICE_STARTER')) return 'starter'
  // Unknown price — fall back to starter so the org at least gets some access
  console.warn(`Unknown Stripe price ID: ${priceId} — defaulting to starter`)
  return 'starter'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!stripeKey || !webhookSecret) {
    console.error('Stripe secrets not configured')
    return json(503, { error: 'Stripe not configured' })
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' })

  // Verify Stripe signature — reject any request that isn't from Stripe
  const sig = req.headers.get('stripe-signature')
  if (!sig) return json(400, { error: 'Missing stripe-signature header' })

  let event: Stripe.Event
  try {
    const rawBody = await req.text()
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return json(400, { error: 'Invalid signature' })
  }

  // Admin client — bypasses RLS so we can write to subscriptions + sms_credits
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    switch (event.type) {

      // ── Checkout completed → new subscription ─────────────────────────────
      // The org_id is passed as client_reference_id when creating the session.
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const orgId      = session.client_reference_id
        const customerId = session.customer as string
        const subId      = session.subscription as string

        if (!orgId) {
          console.error('checkout.session.completed: missing client_reference_id (org_id)')
          break
        }

        // Fetch full subscription to get price ID + period
        const stripeSub = await stripe.subscriptions.retrieve(subId)
        const priceId   = stripeSub.items.data[0]?.price?.id ?? ''
        const planId    = planIdFromPriceId(priceId)
        const credits   = creditsForPlan(planId)

        await upsertSubscription(supabase, {
          orgId,
          customerId,
          subId,
          planId,
          status:           stripeSub.status,
          creditsIncluded:  credits,
          periodEnd:        new Date(stripeSub.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        })

        // Top up credits immediately
        await supabase.rpc('reset_sms_credits', { p_org_id: orgId, p_credits: credits })

        console.log(`✓ checkout.session.completed: org=${orgId} plan=${planId} credits=${credits}`)
        break
      }

      // ── Invoice paid → reset credits for new billing cycle ────────────────
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break

        const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const orgId     = await orgIdFromCustomer(supabase, stripeSub.customer as string)
        if (!orgId) { console.warn('invoice.paid: no org found for customer', stripeSub.customer); break }

        const priceId   = stripeSub.items.data[0]?.price?.id ?? ''
        const planId    = planIdFromPriceId(priceId)
        const credits   = creditsForPlan(planId)

        await upsertSubscription(supabase, {
          orgId,
          customerId:       stripeSub.customer as string,
          subId:            stripeSub.id,
          planId,
          status:           stripeSub.status,
          creditsIncluded:  credits,
          periodEnd:        new Date(stripeSub.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        })

        // Reset credits — fresh cycle
        await supabase.rpc('reset_sms_credits', { p_org_id: orgId, p_credits: credits })

        console.log(`✓ invoice.paid: org=${orgId} plan=${planId} credits reset to ${credits}`)
        break
      }

      // ── Subscription updated → sync status and plan ────────────────────────
      // Covers: upgrades, downgrades, pause, reactivation, cancel scheduling.
      case 'customer.subscription.updated': {
        const stripeSub = event.data.object as Stripe.Subscription
        const orgId     = await orgIdFromCustomer(supabase, stripeSub.customer as string)
        if (!orgId) { console.warn('subscription.updated: no org found'); break }

        const priceId  = stripeSub.items.data[0]?.price?.id ?? ''
        const planId   = planIdFromPriceId(priceId)
        const credits  = creditsForPlan(planId)

        await upsertSubscription(supabase, {
          orgId,
          customerId:       stripeSub.customer as string,
          subId:            stripeSub.id,
          planId,
          status:           stripeSub.status,
          creditsIncluded:  credits,
          periodEnd:        new Date(stripeSub.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        })

        // If the org upgraded mid-cycle, top up the difference immediately.
        // If downgraded, do nothing — let them use what they've already got.
        const { data: currentCredit } = await supabase
          .from('sms_credits')
          .select('balance, last_reset_at')
          .eq('org_id', orgId)
          .maybeSingle() as { data: { balance: number; last_reset_at: string } | null }

        const { data: currentSub } = await supabase
          .from('subscriptions')
          .select('credits_included')
          .eq('org_id', orgId)
          .maybeSingle() as { data: { credits_included: number } | null }

        if (currentCredit && currentSub && credits > currentSub.credits_included) {
          // Upgrade: add the extra credits
          const extra = credits - currentSub.credits_included
          await supabase
            .from('sms_credits')
            .update({ balance: currentCredit.balance + extra })
            .eq('org_id', orgId)
        }

        console.log(`✓ subscription.updated: org=${orgId} plan=${planId} status=${stripeSub.status}`)
        break
      }

      // ── Subscription deleted → cancel access ──────────────────────────────
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as Stripe.Subscription
        const orgId     = await orgIdFromCustomer(supabase, stripeSub.customer as string)
        if (!orgId) { console.warn('subscription.deleted: no org found'); break }

        await supabase
          .from('subscriptions')
          .update({
            status:               'canceled',
            cancel_at_period_end: false,
          })
          .eq('org_id', orgId)

        // Zero out credits so SMS is blocked immediately on cancellation.
        await supabase
          .from('sms_credits')
          .update({ balance: 0 })
          .eq('org_id', orgId)

        console.log(`✓ subscription.deleted: org=${orgId} — access revoked`)
        break
      }

      default:
        // Unhandled event type — not an error, just not needed
        console.log(`Unhandled Stripe event: ${event.type}`)
    }

    return json(200, { received: true })

  } catch (err) {
    console.error('stripe-webhook handler error:', err)
    // Return 200 so Stripe doesn't retry — log errors are surfaced in Supabase logs
    return json(200, { received: true, warning: String(err) })
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface SubUpsertParams {
  orgId:             string
  customerId:        string
  subId:             string
  planId:            string
  status:            string
  creditsIncluded:   number
  periodEnd:         string
  cancelAtPeriodEnd: boolean
}

async function upsertSubscription(
  supabase: ReturnType<typeof createClient>,
  p: SubUpsertParams,
): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      org_id:                 p.orgId,
      stripe_customer_id:     p.customerId,
      stripe_subscription_id: p.subId,
      plan_id:                p.planId,
      status:                 p.status,
      credits_included:       p.creditsIncluded,
      current_period_end:     p.periodEnd,
      cancel_at_period_end:   p.cancelAtPeriodEnd,
    }, { onConflict: 'org_id' })

  if (error) throw new Error(`upsertSubscription: ${error.message}`)
}

async function orgIdFromCustomer(
  supabase: ReturnType<typeof createClient>,
  customerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('org_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle() as { data: { org_id: string } | null }
  return data?.org_id ?? null
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
