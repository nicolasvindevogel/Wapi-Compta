-- WAPI One V35.3 - jonctions facturation, utilisateurs et banques

-- Cette migration est autonome : elle fonctionne même si la V35.2 n'a pas été exécutée.
create table if not exists public.compta_billing_issuers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  company_name text not null,
  vat_number text,
  address text,
  email text,
  phone text,
  iban text,
  bic text,
  invoice_prefix text not null,
  numbering_year integer not null default extract(year from current_date)::integer,
  next_number integer not null default 1,
  pdf_color text default '#5b4bdb',
  logo_url text,
  supplier_id uuid references public.compta_suppliers(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.compta_billing_issuers
  add column if not exists supplier_id uuid references public.compta_suppliers(id) on delete set null;

insert into public.compta_billing_issuers(code,company_name,invoice_prefix)
values ('WAPI','WAPI SYNDIK','WS'),('DLT','DL TECHNIK','DLT')
on conflict(code) do nothing;

alter table if exists public.compta_syndic_billing_contracts
  add column if not exists contract_year integer,
  add column if not exists renewed_from_contract_id uuid references public.compta_syndic_billing_contracts(id) on delete set null,
  add column if not exists indexation_rate numeric(8,4),
  add column if not exists renewed_at timestamptz;

update public.compta_syndic_billing_contracts
set contract_year = coalesce(
  nullif(substring(year_label from '(20[0-9]{2})'),'')::integer,
  extract(year from created_at)::integer
)
where contract_year is null;

alter table if exists public.compta_user_profiles
  add column if not exists mobile text,
  add column if not exists job_title text,
  add column if not exists address text;

-- Relie automatiquement les emetteurs existants aux fournisseurs homonymes.
update public.compta_billing_issuers i
set supplier_id=s.id
from public.compta_suppliers s
where i.supplier_id is null
  and regexp_replace(lower(coalesce(s.name,'')),'[^a-z0-9]','','g') =
      regexp_replace(lower(coalesce(i.company_name,'')),'[^a-z0-9]','','g');

create index if not exists idx_billing_issuers_supplier on public.compta_billing_issuers(supplier_id);
create index if not exists idx_syndic_contract_year on public.compta_syndic_billing_contracts(contract_year);

grant select,insert,update,delete on public.compta_billing_issuers to authenticated;
grant select,insert,update on public.compta_user_profiles to authenticated;

alter table public.compta_billing_issuers enable row level security;
drop policy if exists billing_issuers_authenticated on public.compta_billing_issuers;
create policy billing_issuers_authenticated on public.compta_billing_issuers
  for all to authenticated using(true) with check(true);

create or replace function public.wapi_next_issuer_invoice_number(p_issuer_id uuid)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.compta_billing_issuers%rowtype;
  result text;
begin
  select * into r
  from public.compta_billing_issuers
  where id=p_issuer_id and active=true
  for update;

  if not found then
    raise exception 'Emetteur de facturation introuvable ou inactif';
  end if;

  if r.numbering_year <> extract(year from current_date)::integer then
    r.numbering_year := extract(year from current_date)::integer;
    r.next_number := 1;
  end if;

  result := r.invoice_prefix || '-' || r.numbering_year || '-' || lpad(r.next_number::text,5,'0');

  update public.compta_billing_issuers
  set numbering_year=r.numbering_year,
      next_number=r.next_number+1,
      updated_at=now()
  where id=p_issuer_id;

  return result;
end $$;

grant execute on function public.wapi_next_issuer_invoice_number(uuid) to authenticated;
