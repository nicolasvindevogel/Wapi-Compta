-- WAPI One V35.5
-- Unifie les comptes bancaires encodés dans les réglages copropriété
-- avec les comptes utilisés par les extraits, CODA et grands livres.

create or replace function public.wapi_sync_copro_bank_to_finance()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  financial_id public.compta_bank_accounts.id%type;
begin
  select id into financial_id
  from public.compta_bank_accounts
  where copro_id = new.copro_id
    and regexp_replace(upper(coalesce(iban, '')), '[^A-Z0-9]', '', 'g')
        = regexp_replace(upper(coalesce(new.iban, '')), '[^A-Z0-9]', '', 'g')
  order by created_at
  limit 1;

  if financial_id is null then
    insert into public.compta_bank_accounts
      (copro_id, label, iban, bic, active)
    values
      (new.copro_id, coalesce(nullif(new.label, ''), 'Compte bancaire'), new.iban,
       nullif(new.bic, ''), coalesce(new.active, true));
  else
    update public.compta_bank_accounts
    set label = coalesce(nullif(new.label, ''), label),
        iban = new.iban,
        bic = nullif(new.bic, ''),
        active = coalesce(new.active, true)
    where id = financial_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_wapi_sync_copro_bank_to_finance
on public.compta_copro_bank_accounts;

create trigger trg_wapi_sync_copro_bank_to_finance
after insert or update of copro_id, label, iban, bic, active
on public.compta_copro_bank_accounts
for each row execute function public.wapi_sync_copro_bank_to_finance();

-- Rattrapage des comptes déjà présents dans les réglages (dont CONCORDE).
do $$
declare
  bank_row record;
begin
  for bank_row in select * from public.compta_copro_bank_accounts loop
    if not exists (
      select 1
      from public.compta_bank_accounts financial
      where financial.copro_id = bank_row.copro_id
        and regexp_replace(upper(coalesce(financial.iban, '')), '[^A-Z0-9]', '', 'g')
            = regexp_replace(upper(coalesce(bank_row.iban, '')), '[^A-Z0-9]', '', 'g')
    ) then
      insert into public.compta_bank_accounts
        (copro_id, label, iban, bic, active)
      values
        (bank_row.copro_id, coalesce(nullif(bank_row.label, ''), 'Compte bancaire'),
         bank_row.iban, nullif(bank_row.bic, ''), coalesce(bank_row.active, true));
    end if;
  end loop;
end;
$$;

create index if not exists idx_compta_bank_accounts_copro_active
on public.compta_bank_accounts (copro_id, active);

create index if not exists idx_compta_bank_statements_account_date
on public.compta_bank_statements (bank_account_id, statement_date desc);

create index if not exists idx_compta_bank_transactions_account_date
on public.compta_bank_transactions (bank_account_id, transaction_date desc);
