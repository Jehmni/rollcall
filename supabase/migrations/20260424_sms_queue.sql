-- Migration to create an enqueue function using pg_net for asynchronous SMS dispatch
-- This allows the Edge Function to safely process thousands of members without timing out
-- by splitting them into chunks and relying on pg_net to orchestrate the webhook invocations.

create or replace function public.enqueue_sms_chunk(
  p_service_id uuid,
  p_member_ids uuid[],
  p_project_url text,
  p_service_role_key text
)
returns void
language plpgsql
security definer
as $$
declare
  request_body jsonb;
begin
  request_body := jsonb_build_object(
    'service_id', p_service_id,
    'member_ids', p_member_ids
  );

  perform net.http_post(
    url := p_project_url || '/functions/v1/send-absence-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || p_service_role_key
    ),
    body := request_body
  );
end;
$$;

-- Grant execution to the service role, and anon/authenticated (though it is secured by checking the secret in edge function anyway)
grant execute on function public.enqueue_sms_chunk(uuid, uuid[], text, text) to service_role;
grant execute on function public.enqueue_sms_chunk(uuid, uuid[], text, text) to authenticated;
grant execute on function public.enqueue_sms_chunk(uuid, uuid[], text, text) to anon;
