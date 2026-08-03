-- WAPI One V35.3 - jonctions facturation, utilisateurs et banques

alter table if exists public.compta_billing_issuers
  add column if not exists supplier_id uuid references public.compta_suppliers(id) on delete set null;

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

