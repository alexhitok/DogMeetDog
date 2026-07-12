create or replace function public.ensure_default_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists profiles_ensure_default_user_role on public.profiles;

create trigger profiles_ensure_default_user_role
after insert on public.profiles
for each row
execute function public.ensure_default_user_role();

insert into public.user_roles (user_id, role)
select profiles.id, 'user'
from public.profiles
left join public.user_roles on user_roles.user_id = profiles.id
where user_roles.user_id is null
on conflict (user_id) do nothing;