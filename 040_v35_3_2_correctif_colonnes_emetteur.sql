-- WAPI One V35.3.2 - correctif immédiat société émettrice / contrats récurrents

alter table public.compta_syndic_billing_contracts
  add column if not exists issuer_id uuid references public.compta_billing_issuers(id) on delete restrict,
  add column if not exists service_family text not null default 'syndic_fee',
  add column if not exists contract_year integer,
  add column if not exists renewed_from_contract_id uuid references public.compta_syndic_billing_contracts(id) on delete set null,
  add column if not exists indexation_rate numeric(8,4),
  add column if not exists renewed_at timestamptz;

alter table public.compta_syndic_invoices
  add column if not exists issuer_id uuid references public.compta_billing_issuers(id) on delete restrict;

update public.compta_syndic_billing_contracts c
set issuer_id=i.id
from public.compta_billing_issuers i
where c.issuer_id is null and i.code='WAPI';

update public.compta_syndic_invoices f
set issuer_id=i.id
from public.compta_billing_issuers i
where f.issuer_id is null and i.code='WAPI';

create index if not exists idx_syndic_contracts_issuer
  on public.compta_syndic_billing_contracts(issuer_id);

create index if not exists idx_syndic_invoices_issuer
  on public.compta_syndic_invoices(issuer_id);

notify pgrst, 'reload schema';
