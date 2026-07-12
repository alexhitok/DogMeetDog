create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('playdate_request_received', 'playdate_request_accepted', 'playdate_request_declined', 'new_message')),
  actor_user_id uuid references public.profiles (id) on delete set null,
  playdate_request_id uuid references public.playdate_requests (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  message_id uuid references public.messages (id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_context_check check (
    (type = 'playdate_request_received' and playdate_request_id is not null and conversation_id is null and message_id is null)
    or (type in ('playdate_request_accepted', 'playdate_request_declined') and playdate_request_id is not null and conversation_id is null and message_id is null)
    or (type = 'new_message' and conversation_id is not null and message_id is not null and playdate_request_id is null)
  ),
  constraint notifications_body_not_blank check (char_length(btrim(body)) > 0),
  constraint notifications_title_not_blank check (char_length(btrim(title)) > 0)
);

create index if not exists notifications_user_created_at_idx
on public.notifications (user_id, created_at desc);

create index if not exists notifications_unread_idx
on public.notifications (user_id, created_at desc)
where read_at is null;

create index if not exists notifications_user_read_at_idx
on public.notifications (user_id, read_at);

create unique index if not exists notifications_unique_playdate_event_idx
on public.notifications (user_id, type, playdate_request_id)
where type in ('playdate_request_received', 'playdate_request_accepted', 'playdate_request_declined');

create unique index if not exists notifications_unique_message_event_idx
on public.notifications (user_id, type, message_id)
where type = 'new_message';

create or replace function public.create_playdate_request_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_recipient_owner_id uuid;
  v_sender_dog_name text;
  v_recipient_dog_name text;
begin
  if v_actor_user_id is null then
    return new;
  end if;

  select recipient_dog.owner_id, sender_dog.name, recipient_dog.name
  into v_recipient_owner_id, v_sender_dog_name, v_recipient_dog_name
  from public.playdate_requests
  join public.dogs as sender_dog on sender_dog.id = new.sender_dog_id
  join public.dogs as recipient_dog on recipient_dog.id = new.recipient_dog_id
  where public.playdate_requests.id = new.id;

  if v_recipient_owner_id is null or v_recipient_owner_id = v_actor_user_id then
    return new;
  end if;

  insert into public.notifications (
    user_id,
    type,
    actor_user_id,
    playdate_request_id,
    title,
    body
  )
  values (
    v_recipient_owner_id,
    'playdate_request_received',
    v_actor_user_id,
    new.id,
    'New playdate request',
    coalesce(v_sender_dog_name, 'A dog') || ' sent a playdate request for ' || coalesce(v_recipient_dog_name, 'your dog') || '.'
  )
  on conflict do nothing;

  return new;
end;
$$;

create or replace function public.create_playdate_request_status_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_sender_owner_id uuid;
  v_sender_dog_name text;
  v_recipient_dog_name text;
  v_type text;
  v_title text;
  v_body text;
begin
  if v_actor_user_id is null then
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  if old.status <> 'pending' then
    return new;
  end if;

  if new.status = 'accepted' then
    v_type := 'playdate_request_accepted';
    v_title := 'Playdate request accepted';
  elsif new.status = 'declined' then
    v_type := 'playdate_request_declined';
    v_title := 'Playdate request declined';
  else
    return new;
  end if;

  select sender_dog.owner_id, sender_dog.name, recipient_dog.name
  into v_sender_owner_id, v_sender_dog_name, v_recipient_dog_name
  from public.playdate_requests
  join public.dogs as sender_dog on sender_dog.id = new.sender_dog_id
  join public.dogs as recipient_dog on recipient_dog.id = new.recipient_dog_id
  where public.playdate_requests.id = new.id;

  if v_sender_owner_id is null or v_sender_owner_id = v_actor_user_id then
    return new;
  end if;

  if new.status = 'accepted' then
    v_body := coalesce(v_recipient_dog_name, 'The recipient dog') || ' accepted the playdate request for ' || coalesce(v_sender_dog_name, 'your dog') || '.';
  else
    v_body := coalesce(v_recipient_dog_name, 'The recipient dog') || ' declined the playdate request for ' || coalesce(v_sender_dog_name, 'your dog') || '.';
  end if;

  insert into public.notifications (
    user_id,
    type,
    actor_user_id,
    playdate_request_id,
    title,
    body
  )
  values (
    v_sender_owner_id,
    v_type,
    v_actor_user_id,
    new.id,
    v_title,
    v_body
  )
  on conflict do nothing;

  return new;
end;
$$;

create or replace function public.create_message_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_sender_dog_name text;
  v_recipient_dog_name text;
  v_body text;
begin
  if v_actor_user_id is null then
    return new;
  end if;

  select sender_dog.name, recipient_dog.name
  into v_sender_dog_name, v_recipient_dog_name
  from public.conversations
  join public.playdate_requests on public.playdate_requests.id = public.conversations.playdate_request_id
  join public.dogs as sender_dog on sender_dog.id = public.playdate_requests.sender_dog_id
  join public.dogs as recipient_dog on recipient_dog.id = public.playdate_requests.recipient_dog_id
  where public.conversations.id = new.conversation_id;

  v_body := 'New message in your conversation about ' || coalesce(v_sender_dog_name, 'your dogs') || ' and ' || coalesce(v_recipient_dog_name, 'your dogs') || '.';

  insert into public.notifications (
    user_id,
    type,
    actor_user_id,
    conversation_id,
    message_id,
    title,
    body
  )
  select
    member.user_id,
    'new_message',
    new.sender_id,
    new.conversation_id,
    new.id,
    'New message',
    v_body
  from public.conversation_members as member
  where member.conversation_id = new.conversation_id
    and member.user_id <> new.sender_id
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists notifications_playdate_insert on public.playdate_requests;
create trigger notifications_playdate_insert
after insert on public.playdate_requests
for each row
execute function public.create_playdate_request_notification();

drop trigger if exists notifications_playdate_status_update on public.playdate_requests;
create trigger notifications_playdate_status_update
after update on public.playdate_requests
for each row
when (old.status = 'pending' and new.status in ('accepted', 'declined'))
execute function public.create_playdate_request_status_notification();

drop trigger if exists notifications_message_insert on public.messages;
create trigger notifications_message_insert
after insert on public.messages
for each row
execute function public.create_message_notifications();

alter table public.notifications enable row level security;

drop policy if exists "Recipients can read their notifications" on public.notifications;

create policy "Recipients can read their notifications"
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.mark_notification_read(p_notification_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to update notifications.';
  end if;

  update public.notifications
  set read_at = now()
  where id = p_notification_id
    and user_id = auth.uid()
    and read_at is null;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to update notifications.';
  end if;

  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;