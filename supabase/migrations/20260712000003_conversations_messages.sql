create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  playdate_request_id uuid not null references public.playdate_requests (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists conversations_playdate_request_id_idx
on public.conversations (playdate_request_id);

create index if not exists conversations_created_at_idx
on public.conversations (created_at desc);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_id_idx
on public.conversation_members (user_id, conversation_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_not_blank check (char_length(btrim(body)) > 0),
  constraint messages_body_max_length check (char_length(body) <= 2000)
);

create index if not exists messages_conversation_created_at_idx
on public.messages (conversation_id, created_at asc, id asc);

create index if not exists messages_sender_id_idx
on public.messages (sender_id);

create or replace function public.is_conversation_member(conversation_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_members.conversation_id = conversation_uuid
      and conversation_members.user_id = auth.uid()
  );
$$;

create or replace function public.get_or_create_conversation(p_playdate_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sender_owner_id uuid;
  v_recipient_owner_id uuid;
  v_request_status text;
  v_conversation_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be logged in to open a conversation.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_playdate_request_id::text, 0));

  select
    playdate_requests.status,
    sender_dog.owner_id,
    recipient_dog.owner_id
  into v_request_status, v_sender_owner_id, v_recipient_owner_id
  from public.playdate_requests
  join public.dogs as sender_dog on sender_dog.id = playdate_requests.sender_dog_id
  join public.dogs as recipient_dog on recipient_dog.id = playdate_requests.recipient_dog_id
  where playdate_requests.id = p_playdate_request_id;

  if not found then
    raise exception 'Playdate request not found.';
  end if;

  if v_request_status <> 'accepted' then
    raise exception 'Conversations can be created only for accepted playdate requests.';
  end if;

  if v_user_id <> v_sender_owner_id and v_user_id <> v_recipient_owner_id then
    raise exception 'You can open this conversation only for your accepted match.';
  end if;

  insert into public.conversations (playdate_request_id)
  values (p_playdate_request_id)
  on conflict (playdate_request_id) do nothing
  returning id into v_conversation_id;

  if v_conversation_id is null then
    select id
    into v_conversation_id
    from public.conversations
    where playdate_request_id = p_playdate_request_id;
  end if;

  insert into public.conversation_members (conversation_id, user_id)
  select v_conversation_id, member_id
  from (
    values (v_sender_owner_id), (v_recipient_owner_id)
  ) as members(member_id)
  where member_id is not null
  on conflict do nothing;

  return v_conversation_id;
end;
$$;

create or replace function public.enforce_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to send messages.';
  end if;

  if new.sender_id is distinct from auth.uid() then
    raise exception 'Message sender must match the authenticated user.';
  end if;

  if new.body is null or char_length(btrim(new.body)) = 0 then
    raise exception 'Message body cannot be empty.';
  end if;

  if char_length(new.body) > 2000 then
    raise exception 'Message body must be 2000 characters or fewer.';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_validate_insert on public.messages;
create trigger messages_validate_insert
before insert on public.messages
for each row
execute function public.enforce_message_insert();

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Conversation members can read conversations" on public.conversations;
drop policy if exists "Conversation members can read member rows" on public.conversation_members;
drop policy if exists "Conversation members can read messages" on public.messages;
drop policy if exists "Conversation members can insert messages" on public.messages;

create policy "Conversation members can read conversations"
on public.conversations
for select
to authenticated
using (public.is_conversation_member(id));

create policy "Conversation members can read member rows"
on public.conversation_members
for select
to authenticated
using (public.is_conversation_member(conversation_id));

create policy "Conversation members can read messages"
on public.messages
for select
to authenticated
using (public.is_conversation_member(conversation_id));

create policy "Conversation members can insert messages"
on public.messages
for insert
to authenticated
with check (
  public.is_conversation_member(conversation_id)
  and sender_id = auth.uid()
);