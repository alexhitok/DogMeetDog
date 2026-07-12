create or replace function public.is_dog_owner(dog_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.dogs
    where dogs.id = dog_uuid
      and dogs.owner_id = auth.uid()
  );
$$;

alter table public.dogs
  add column if not exists location_city text,
  add column if not exists location_latitude numeric(9,6),
  add column if not exists location_longitude numeric(9,6),
  add column if not exists location_visibility text;

alter table public.dogs
  alter column location_visibility set default 'approximate';

update public.dogs
set location_visibility = coalesce(location_visibility, 'approximate')
where location_visibility is null;

alter table public.dogs
  drop constraint if exists dogs_location_visibility_check;

alter table public.dogs
  add constraint dogs_location_visibility_check
  check (location_visibility in ('approximate', 'hidden'));

alter table public.dogs
  drop constraint if exists dogs_location_coordinates_pair_check;

alter table public.dogs
  add constraint dogs_location_coordinates_pair_check
  check (
    (location_latitude is null and location_longitude is null)
    or (location_latitude is not null and location_longitude is not null)
  );

alter table public.dogs
  drop constraint if exists dogs_location_latitude_range_check;

alter table public.dogs
  add constraint dogs_location_latitude_range_check
  check (location_latitude is null or (location_latitude between -90 and 90));

alter table public.dogs
  drop constraint if exists dogs_location_longitude_range_check;

alter table public.dogs
  add constraint dogs_location_longitude_range_check
  check (location_longitude is null or (location_longitude between -180 and 180));

create index if not exists dogs_location_city_idx on public.dogs (location_city);
create index if not exists dogs_location_district_idx on public.dogs (district);
create index if not exists dogs_location_coordinates_idx on public.dogs (location_latitude, location_longitude)
where location_latitude is not null and location_longitude is not null;

create table if not exists public.playdate_requests (
  id uuid primary key default gen_random_uuid(),
  sender_dog_id uuid not null references public.dogs (id) on delete cascade,
  recipient_dog_id uuid not null references public.dogs (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint playdate_requests_sender_not_recipient check (sender_dog_id <> recipient_dog_id)
);

create unique index if not exists playdate_requests_unique_pending_idx
on public.playdate_requests (sender_dog_id, recipient_dog_id)
where status = 'pending';

create index if not exists playdate_requests_sender_idx on public.playdate_requests (sender_dog_id);
create index if not exists playdate_requests_recipient_idx on public.playdate_requests (recipient_dog_id);
create index if not exists playdate_requests_status_idx on public.playdate_requests (status);
create index if not exists playdate_requests_created_at_idx on public.playdate_requests (created_at desc);

create or replace function public.set_playdate_request_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.enforce_playdate_request_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sender_dog_id <> old.sender_dog_id
     or new.recipient_dog_id <> old.recipient_dog_id
     or new.created_at <> old.created_at then
    raise exception 'Playdate request dogs and creation time are immutable.';
  end if;

  if old.status = 'pending' then
    if new.status not in ('accepted', 'declined', 'cancelled') then
      raise exception 'Pending playdate requests can only be accepted, declined, or cancelled.';
    end if;
  else
    raise exception 'Only pending playdate requests can be updated.';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists playdate_requests_set_updated_at on public.playdate_requests;
create trigger playdate_requests_set_updated_at
before update on public.playdate_requests
for each row
execute function public.set_playdate_request_updated_at();

drop trigger if exists playdate_requests_enforce_update on public.playdate_requests;
create trigger playdate_requests_enforce_update
before update on public.playdate_requests
for each row
execute function public.enforce_playdate_request_update();

alter table public.playdate_requests enable row level security;

drop policy if exists "Owners of involved dogs can read playdate requests" on public.playdate_requests;
drop policy if exists "Sender dog owners can create playdate requests" on public.playdate_requests;
drop policy if exists "Recipient dog owners can accept or decline playdate requests" on public.playdate_requests;
drop policy if exists "Sender dog owners can cancel pending playdate requests" on public.playdate_requests;

create policy "Owners of involved dogs can read playdate requests"
on public.playdate_requests
for select
to authenticated
using (
  public.is_dog_owner(sender_dog_id)
  or public.is_dog_owner(recipient_dog_id)
);

create policy "Sender dog owners can create playdate requests"
on public.playdate_requests
for insert
to authenticated
with check (
  status = 'pending'
  and sender_dog_id <> recipient_dog_id
  and public.is_dog_owner(sender_dog_id)
);

create policy "Recipient dog owners can accept or decline playdate requests"
on public.playdate_requests
for update
to authenticated
using (
  status = 'pending'
  and public.is_dog_owner(recipient_dog_id)
)
with check (
  status in ('accepted', 'declined')
  and public.is_dog_owner(recipient_dog_id)
);

create policy "Sender dog owners can cancel pending playdate requests"
on public.playdate_requests
for update
to authenticated
using (
  status = 'pending'
  and public.is_dog_owner(sender_dog_id)
)
with check (
  status = 'cancelled'
  and public.is_dog_owner(sender_dog_id)
);