-- ============================================================
-- WAPI One V32.3 — Gestion multi-utilisateur / gestionnaires
-- Objectif : utiliser les utilisateurs Supabase Auth existants
-- dans WAPI One, attribuer un gestionnaire à une copropriété,
-- puis permettre des filtres multi-copro par gestionnaire.
-- ============================================================

-- 1) Profils applicatifs basés sur auth.users
create table if not exists public.compta_user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'gestionnaire',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.compta_user_profiles add column if not exists phone text;
alter table public.compta_user_profiles add column if not exists initials text;
alter table public.compta_user_profiles add column if not exists notes text;

-- Récupération initiale des utilisateurs Supabase Auth déjà existants.
insert into public.compta_user_profiles (id, email, display_name, role, active)
select
  u.id,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data->>'full_name',''),
    nullif(u.raw_user_meta_data->>'name',''),
    split_part(u.email, '@', 1)
  ) as display_name,
  'gestionnaire',
  true
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  display_name = coalesce(public.compta_user_profiles.display_name, excluded.display_name),
  updated_at = now();

-- Synchronisation automatique lorsqu'un nouvel utilisateur Supabase est créé.
create or replace function public.compta_sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.compta_user_profiles (id, email, display_name, role, active)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name',''),
      nullif(new.raw_user_meta_data->>'name',''),
      split_part(new.email, '@', 1)
    ),
    'gestionnaire',
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.compta_user_profiles.display_name, excluded.display_name),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists compta_sync_auth_user_profile_trigger on auth.users;
create trigger compta_sync_auth_user_profile_trigger
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.compta_sync_auth_user_profile();

-- 2) Attribution d'un gestionnaire à chaque copropriété
alter table public.compta_copros add column if not exists manager_user_id uuid references public.compta_user_profiles(id) on delete set null;
alter table public.compta_copros add column if not exists manager_name text;

create index if not exists idx_compta_copros_manager_user_id on public.compta_copros(manager_user_id);

-- 3) Journal léger de changement de gestionnaire pour traçabilité future
create table if not exists public.compta_copro_manager_history (
  id uuid primary key default gen_random_uuid(),
  copro_id uuid not null references public.compta_copros(id) on delete cascade,
  previous_manager_user_id uuid references public.compta_user_profiles(id) on delete set null,
  new_manager_user_id uuid references public.compta_user_profiles(id) on delete set null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  note text
);

-- 4) RLS basique interne
alter table public.compta_user_profiles enable row level security;
alter table public.compta_copro_manager_history enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='compta_user_profiles' and policyname='compta_user_profiles_select_authenticated'
  ) then
    create policy compta_user_profiles_select_authenticated on public.compta_user_profiles
      for select using (auth.role() = 'authenticated');
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='compta_user_profiles' and policyname='compta_user_profiles_update_authenticated'
  ) then
    create policy compta_user_profiles_update_authenticated on public.compta_user_profiles
      for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='compta_copro_manager_history' and policyname='compta_copro_manager_history_all_authenticated'
  ) then
    create policy compta_copro_manager_history_all_authenticated on public.compta_copro_manager_history
      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;

-- 5) Compatibilité : si manager_name existait déjà, on le conserve.
update public.compta_copros c
set manager_name = p.display_name
from public.compta_user_profiles p
where c.manager_user_id = p.id
  and (c.manager_name is null or trim(c.manager_name) = '');
