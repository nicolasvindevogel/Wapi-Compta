-- WAPI One V34.9 — points de fourniture et profils de comptabilisation OCR
create table if not exists public.compta_supply_profiles (
  id uuid primary key default gen_random_uuid(),
  copro_id uuid not null references public.compta_copros(id) on delete cascade,
  supplier_id uuid references public.compta_suppliers(id) on delete set null,
  service_type text not null check (service_type in ('electricity','gas','water','other')),
  label text not null,
  ean text,
  meter_number text,
  keywords text[] not null default '{}',
  account_id uuid references public.compta_accounts(id) on delete set null,
  distribution_key_id uuid references public.compta_distribution_keys(id) on delete set null,
  charge_target text default 'common_owner',
  label_template text default '{service} — {mois} {année}',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_compta_supply_profiles_ean
on public.compta_supply_profiles (regexp_replace(upper(ean),'[^A-Z0-9]','','g'))
where ean is not null and length(regexp_replace(ean,'[^A-Za-z0-9]','','g')) >= 8;

create index if not exists idx_compta_supply_profiles_copro
on public.compta_supply_profiles (copro_id, active);

create index if not exists idx_compta_supply_profiles_supplier
on public.compta_supply_profiles (supplier_id, service_type);

alter table public.compta_supply_profiles enable row level security;

drop policy if exists "authenticated_read_supply_profiles" on public.compta_supply_profiles;
create policy "authenticated_read_supply_profiles"
on public.compta_supply_profiles for select to authenticated
using (true);

drop policy if exists "authenticated_write_supply_profiles" on public.compta_supply_profiles;
create policy "authenticated_write_supply_profiles"
on public.compta_supply_profiles for all to authenticated
using (true) with check (true);

grant select, insert, update, delete on public.compta_supply_profiles to authenticated;

alter table public.compta_invoices
  add column if not exists distribution_key_id uuid
    references public.compta_distribution_keys(id) on delete set null,
  add column if not exists charge_target text default 'common_owner',
  add column if not exists supply_profile_id uuid
    references public.compta_supply_profiles(id) on delete set null;
