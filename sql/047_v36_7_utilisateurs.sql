-- WAPI One V36.7 — gestion des utilisateurs
alter table public.compta_user_profiles add column if not exists phone text;
alter table public.compta_user_profiles add column if not exists initials text;
alter table public.compta_user_profiles add column if not exists notes text;

-- Garantit qu'il existe au moins un administrateur pour créer les accès suivants.
do $$
begin
  if not exists (select 1 from public.compta_user_profiles where role = 'admin' and active = true) then
    update public.compta_user_profiles
       set role = 'admin', updated_at = now()
     where id = (select id from public.compta_user_profiles where active = true order by created_at asc limit 1);
  end if;
end $$;

grant select, update on public.compta_user_profiles to authenticated;

-- Remplace l'ancienne règle trop large : seul un administrateur actif peut
-- modifier les rôles, statuts et coordonnées depuis le module Utilisateurs.
create or replace function public.compta_is_admin(check_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.compta_user_profiles where id = check_user and role = 'admin' and active = true) $$;
revoke all on function public.compta_is_admin(uuid) from public;
grant execute on function public.compta_is_admin(uuid) to authenticated;

drop policy if exists compta_user_profiles_update_authenticated on public.compta_user_profiles;
drop policy if exists compta_user_profiles_admin_update on public.compta_user_profiles;
create policy compta_user_profiles_admin_update
on public.compta_user_profiles
for update to authenticated
using (public.compta_is_admin())
with check (public.compta_is_admin());
