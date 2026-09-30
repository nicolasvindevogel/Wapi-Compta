-- WAPI One V35.4 - contrats recurrents automatiques

alter table public.compta_syndic_billing_contracts
  add column if not exists starts_on date,
  add column if not exists ends_on date,
  add column if not exists billing_from date,
  add column if not exists auto_account boolean not null default false,
  add column if not exists contract_status text not null default 'active',
  add column if not exists stopped_at timestamptz,
  add column if not exists last_automation_at timestamptz;

update public.compta_syndic_billing_contracts
set starts_on=make_date(
      coalesce(contract_year,nullif(substring(year_label from '(20[0-9]{2})'),'')::integer,extract(year from created_at)::integer),
      greatest(1,least(12,coalesce(start_month,1))),1),
    ends_on=(make_date(
      coalesce(contract_year,nullif(substring(year_label from '(20[0-9]{2})'),'')::integer,extract(year from created_at)::integer),
      greatest(1,least(12,coalesce(end_month,12))),1)+interval '1 month - 1 day')::date,
    billing_from=coalesce(billing_from,make_date(
      coalesce(contract_year,nullif(substring(year_label from '(20[0-9]{2})'),'')::integer,extract(year from created_at)::integer),
      greatest(1,least(12,coalesce(start_month,1))),1))
where starts_on is null or ends_on is null or billing_from is null;

alter table public.compta_syndic_billing_contracts
  drop constraint if exists compta_syndic_contract_status_check;
alter table public.compta_syndic_billing_contracts
  add constraint compta_syndic_contract_status_check
  check(contract_status in ('active','stopped','expired'));

create index if not exists idx_syndic_contract_automation
  on public.compta_syndic_billing_contracts(auto_account,contract_status,starts_on,ends_on);

notify pgrst, 'reload schema';

