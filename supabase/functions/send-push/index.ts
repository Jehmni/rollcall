import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
    const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@rollcally.com'
    const APP_URL           = Deno.env.get('APP_URL') ?? 'https://rollcally.com'

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { service_id, unit_id } = await req.json() as { service_id: string; unit_id: string }

    // Fetch service + unit name
    const { data: service } = await supabase
      .from('services')
      .select('id, date, service_type, unit_id, units(name)')
      .eq('id', service_id)
      .single()

    if (!service) {
      return new Response(JSON.stringify({ error: 'Service not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch all push subscriptions for this unit
    const { data: subscriptions } = await supabase
      .from('member_push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('unit_id', unit_id)

    if (!subscriptions || subscriptions.length === 0) {
      // Still mark as sent so the admin sees the button change state
      await supabase
        .from('services')
        .update({ notification_sent_at: new Date().toISOString() })
        .eq('id', service_id)
      return new Response(JSON.stringify({ sent: 0, message: 'No subscribers yet' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const unitName   = (service.units as { name: string } | null)?.name ?? 'Your group'
    const checkinUrl = `${APP_URL}/checkin?service_id=${service_id}`

    const payload = JSON.stringify({
      title: `${unitName} session starting`,
      body: 'Tap to check in instantly — no QR scan needed.',
      url: checkinUrl,
      icon: '/icons/icon-192.png',
    })

    let sent = 0
    const expiredEndpoints: string[] = []

    await Promise.allSettled(
      subscriptions.map(async (sub: { endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
          sent++
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode
          if (status === 410 || status === 404) {
            expiredEndpoints.push(sub.endpoint)
          }
        }
      }),
    )

    // Remove expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from('member_push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints)
    }

    // Mark service as notified
    await supabase
      .from('services')
      .update({ notification_sent_at: new Date().toISOString() })
      .eq('id', service_id)

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    console.error('send-push error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
