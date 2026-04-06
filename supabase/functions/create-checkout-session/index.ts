/**
 * create-checkout-session — Rollcally Edge Function
 *
 * Creates a Stripe Checkout Session for an organisation owner who wants to
 * subscribe or upgrade their plan.
 *
 * Required secrets:
 *   STRIPE_SECRET_KEY      Stripe secret key
 *   STRIPE_PRICE_STARTER   Stripe Price ID for the Starter plan
 *   STRIPE_PRICE_GROWTH    Stripe Price ID for the Growth plan
 *   STRIPE_PRICE_PRO       Stripe Price ID for the Pro plan
 *   APP_URL                Your frontend origin e.g. https://app.rollcally.com
 *
 * Request body:
 *   { plan_id: 'starter' | 'growth' | 'pro', org_id: string }
 *
 * Returns:
 *   { url: string }  — redirect the user to this Stripe Checkout URL
 *
 * Security:
 *   Caller must be authenticated AND be an owner of org_id.
 *   An existing Stripe customer ID is reused if the org already has a
 *   subscription row (supports plan changes and resubscription).
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PRICE_IDS: Record<string, string | undefined> = {
  starter: Deno.env.get('STRIPE_PRICE_STARTER'),
  growth:  Deno.env.get('STRIPE_PRICE_GROWTH'),
  pro:     Deno.env.get('STRIPE_PRICE_PRO'),
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeKey) return json(503, { error: 'Stripe not configured' })

  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
  const authHeader = req.headers.get('Authorization') ?? ''

  // Authenticate the caller
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return json(401, { error: 'Unauthenticated' })

  let body: { plan_id?: string; org_id?: string }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const { plan_id, org_id } = body
  if (!plan_id || !org_id) return json(400, { error: 'plan_id and org_id are required' })
  if (!['starter', 'growth', 'pro'].includes(plan_id)) return json(400, { error: 'Invalid plan_id' })

  const priceId = PRICE_IDS[plan_id]
  if (!priceId) return json(503, { error: `Price ID for plan "${plan_id}" is not configured` })

  // Verify the caller is the org owner (not just any admin)
  const { data: isOwner } = await userClient.rpc('is_org_owner', { org_id })
  if (!isOwner) return json(403, { error: 'Only the organisation owner can manage billing' })

  // Admin client for reading/writing subscription rows
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Fetch org name for Stripe customer creation
  const { data: org } = await adminClient
    .from('organizations')
    .select('name')
    .eq('id', org_id)
    .single() as { data: { name: string } | null }

  // Check if org already has a Stripe customer ID (for resubscription / upgrade)
  const { data: existingSub } = await adminClient
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id, status')
    .eq('org_id', org_id)
    .maybeSingle() as { data: {
      stripe_customer_id: string
      stripe_subscription_id: string | null
      status: string
    } | null }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' })

  let customerId: string | undefined = existingSub?.stripe_customer_id

  // If switching plan on an active subscription, use Stripe's subscription update
  // (not a new checkout) — redirect to billing portal instead.
  if (
    existingSub?.stripe_subscription_id &&
    existingSub.status === 'active' &&
    customerId
  ) {
    const portal = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${appUrl}/admin/billing?org=${org_id}`,
    })
    return json(200, { url: portal.url, mode: 'portal' })
  }

  // New subscription flow — create customer if needed
  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    user.email,
      name:     org?.name ?? user.email,
      metadata: { org_id, platform: 'rollcally' },
    })
    customerId = customer.id
  }

  const session = await stripe.checkout.sessions.create({
    customer:              customerId,
    client_reference_id:   org_id,  // used by webhook to link back to org
    payment_method_types:  ['card'],
    mode:                  'subscription',
    line_items: [{
      price:    priceId,
      quantity: 1,
    }],
    subscription_data: {
      trial_period_days: 14,  // 14-day free trial on first subscription
      metadata: { org_id, plan_id },
    },
    success_url: `${appUrl}/admin/billing?org=${org_id}&status=success`,
    cancel_url:  `${appUrl}/admin/billing?org=${org_id}&status=canceled`,
    allow_promotion_codes: true,
  })

  return json(200, { url: session.url, mode: 'checkout' })
})

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
