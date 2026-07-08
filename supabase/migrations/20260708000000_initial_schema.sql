create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  city text,
  district text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.dogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  breed text,
  age_years integer,
  size text not null check (size in ('small', 'medium', 'large')),
  gender text not null check (gender in ('male', 'female', 'unknown')),
  temperament text,
  district text,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  constraint dogs_age_years_non_negative check (age_years is null or age_years >= 0)
);

create table if not exists public.dog_photos (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  image_url text not null,
  is_main boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.adoption_posts (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'published' check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.lost_dog_reports (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  last_seen_location text not null,
  last_seen_date date not null,
  contact_phone text,
  status text not null default 'active' check (status in ('active', 'resolved', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  district text not null,
  address text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role = 'admin'
  );
$$;

create index if not exists profiles_city_idx on public.profiles (city);
create index if not exists profiles_district_idx on public.profiles (district);

create index if not exists dogs_owner_id_idx on public.dogs (owner_id);
create index if not exists dogs_status_idx on public.dogs (status);
create index if not exists dogs_district_idx on public.dogs (district);

create index if not exists dog_photos_dog_id_idx on public.dog_photos (dog_id);
create unique index if not exists dog_photos_main_photo_per_dog_idx on public.dog_photos (dog_id)
where is_main;

create index if not exists adoption_posts_dog_id_idx on public.adoption_posts (dog_id);
create index if not exists adoption_posts_status_idx on public.adoption_posts (status);

create index if not exists lost_dog_reports_dog_id_idx on public.lost_dog_reports (dog_id);
create index if not exists lost_dog_reports_status_idx on public.lost_dog_reports (status);
create index if not exists lost_dog_reports_last_seen_date_idx on public.lost_dog_reports (last_seen_date desc);

create index if not exists places_type_idx on public.places (type);
create index if not exists places_district_idx on public.places (district);

create index if not exists user_roles_role_idx on public.user_roles (role);

alter table public.profiles enable row level security;
alter table public.dogs enable row level security;
alter table public.dog_photos enable row level security;
alter table public.adoption_posts enable row level security;
alter table public.lost_dog_reports enable row level security;
alter table public.places enable row level security;
alter table public.user_roles enable row level security;

drop policy if exists "Profiles are readable by owners and admins" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can delete their own profile" on public.profiles;

create policy "Profiles are readable by owners and admins"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid() or public.is_admin());

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "Users can delete their own profile"
on public.profiles
for delete
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "Public can read active dogs" on public.dogs;
drop policy if exists "Authenticated users can create their own dogs" on public.dogs;
drop policy if exists "Owners and admins can update dogs" on public.dogs;
drop policy if exists "Owners and admins can delete dogs" on public.dogs;

create policy "Public can read active dogs"
on public.dogs
for select
to anon, authenticated
using (status = 'active' or owner_id = auth.uid() or public.is_admin());

create policy "Authenticated users can create their own dogs"
on public.dogs
for insert
to authenticated
with check (owner_id = auth.uid() or public.is_admin());

create policy "Owners and admins can update dogs"
on public.dogs
for update
to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "Owners and admins can delete dogs"
on public.dogs
for delete
to authenticated
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "Public can read photos for active dogs" on public.dog_photos;
drop policy if exists "Owners and admins can manage dog photos" on public.dog_photos;

create policy "Public can read photos for active dogs"
on public.dog_photos
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.dogs
    where dogs.id = dog_photos.dog_id
      and (dogs.status = 'active' or dogs.owner_id = auth.uid() or public.is_admin())
  )
);

create policy "Owners and admins can manage dog photos"
on public.dog_photos
for all
to authenticated
using (
  exists (
    select 1
    from public.dogs
    where dogs.id = dog_photos.dog_id
      and (dogs.owner_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.dogs
    where dogs.id = dog_photos.dog_id
      and (dogs.owner_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "Public can read published adoption posts" on public.adoption_posts;
drop policy if exists "Dog owners and admins can manage adoption posts" on public.adoption_posts;

create policy "Public can read published adoption posts"
on public.adoption_posts
for select
to anon, authenticated
using (
  status = 'published'
  or exists (
    select 1
    from public.dogs
    where dogs.id = adoption_posts.dog_id
      and (dogs.owner_id = auth.uid() or public.is_admin())
  )
);

create policy "Dog owners and admins can manage adoption posts"
on public.adoption_posts
for all
to authenticated
using (
  exists (
    select 1
    from public.dogs
    where dogs.id = adoption_posts.dog_id
      and (dogs.owner_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.dogs
    where dogs.id = adoption_posts.dog_id
      and (dogs.owner_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "Public can read active lost dog reports" on public.lost_dog_reports;
drop policy if exists "Dog owners and admins can manage lost dog reports" on public.lost_dog_reports;

create policy "Public can read active lost dog reports"
on public.lost_dog_reports
for select
to anon, authenticated
using (
  status = 'active'
  or exists (
    select 1
    from public.dogs
    where dogs.id = lost_dog_reports.dog_id
      and (dogs.owner_id = auth.uid() or public.is_admin())
  )
);

create policy "Dog owners and admins can manage lost dog reports"
on public.lost_dog_reports
for all
to authenticated
using (
  exists (
    select 1
    from public.dogs
    where dogs.id = lost_dog_reports.dog_id
      and (dogs.owner_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.dogs
    where dogs.id = lost_dog_reports.dog_id
      and (dogs.owner_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "Public can read places" on public.places;
drop policy if exists "Admins can manage places" on public.places;

create policy "Public can read places"
on public.places
for select
to anon, authenticated
using (true);

create policy "Admins can manage places"
on public.places
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can read their own role or admins can read all roles" on public.user_roles;
drop policy if exists "Admins can insert roles" on public.user_roles;
drop policy if exists "Admins can update roles" on public.user_roles;
drop policy if exists "Admins can delete roles" on public.user_roles;

create policy "Users can read their own role or admins can read all roles"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "Admins can insert roles"
on public.user_roles
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update roles"
on public.user_roles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete roles"
on public.user_roles
for delete
to authenticated
using (public.is_admin());