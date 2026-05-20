-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Birthday week-before reminders
-- Date: 2026-05-20
--
-- Changes the advance birthday reminder from one day before to one week before.
-- The existing notification type stays birthday_eve for compatibility with UI
-- and historic rows.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.enqueue_birthday_notifications()
returns void language plpgsql security definer as $$
begin
  insert into member_notifications (unit_id, member_id, type, fire_at)
  select
    unit_id,
    id as member_id,
    'birthday_eve' as type,
    (current_date + interval '7 days' + interval '9 hours')::timestamptz
  from members
  where status   = 'active'
    and birthday is not null
    and to_char(birthday, 'MM-DD') = to_char(current_date + interval '7 days', 'MM-DD')
  on conflict (member_id, type, fire_at) do nothing;

  insert into member_notifications (unit_id, member_id, type, fire_at)
  select
    unit_id,
    id as member_id,
    'birthday_day' as type,
    (current_date + interval '9 hours')::timestamptz
  from members
  where status   = 'active'
    and birthday is not null
    and to_char(birthday, 'MM-DD') = to_char(current_date, 'MM-DD')
  on conflict (member_id, type, fire_at) do nothing;
end;
$$;
