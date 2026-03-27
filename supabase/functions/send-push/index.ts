import webpush from 'npm:web-push@3'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { service_id, unit_id } = await req.json() as { service_id: string; unit_id: string }

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT')!,
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch all subscriptions for the unit
    const { data: subs, error: subsError } = await supabase
      .from('member_push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('unit_id', unit_id)

    if (subsError) throw subsError

    const appUrl = Deno.env.get('APP_URL') ?? 'https://www.rollcally.com'
    const checkinUrl = `${appUrl}/checkin?service_id=${service_id}`

    const payload = JSON.stringify({
      title: 'Session started — check in now',
      body: 'Tap to record your attendance instantly.',
      url: checkinUrl,
    })

    const staleIds: string[] = []

    await Promise.allSettled(
      (subs ?? []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode
          if (status === 410 || status === 404) staleIds.push(sub.id)
        }
      })
    )

    // Clean up expired subscriptions
    if (staleIds.length > 0) {
      await supabase.from('member_push_subscriptions').delete().in('id', staleIds)
    }

    // Mark notification sent
    await supabase
      .from('services')
      .update({ notification_sent_at: new Date().toISOString() })
      .eq('id', service_id)

    return new Response(
      JSON.stringify({ sent: (subs?.length ?? 0) - staleIds.length, stale: staleIds.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
