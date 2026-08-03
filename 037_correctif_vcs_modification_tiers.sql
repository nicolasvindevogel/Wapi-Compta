-- WAPI One V34.7
-- Garde-fous financiers stricts : un compte bancaire et une écriture
-- doivent appartenir à la même copropriété.

create or replace function public.compta_check_bank_context()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  account_copro uuid;
  statement_copro uuid;
begin
  if new.bank_account_id is null then
    raise exception 'Un compte bancaire est obligatoire.';
  end if;

  select copro_id into account_copro
  from public.compta_bank_accounts
  where id = new.bank_account_id;

  if account_copro is null then
    raise exception 'Compte bancaire introuvable.';
  end if;

  if new.copro_id is null then
    new.copro_id := account_copro;
  elsif new.copro_id <> account_copro then
    raise exception 'Le compte bancaire ne correspond pas à la copropriété sélectionnée.';
  end if;

  if tg_table_name = 'compta_bank_transactions' and new.statement_id is not null then
    select copro_id into statement_copro
    from public.compta_bank_statements
    where id = new.statement_id;

    if statement_copro is null or statement_copro <> new.copro_id then
      raise exception 'L''extrait bancaire ne correspond pas à la copropriété sélectionnée.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_compta_bank_statements_context on public.compta_bank_statements;
create trigger trg_compta_bank_statements_context
before insert or update of copro_id, bank_account_id
on public.compta_bank_statements
for each row execute function public.compta_check_bank_context();

drop trigger if exists trg_compta_bank_transactions_context on public.compta_bank_transactions;
create trigger trg_compta_bank_transactions_context
before insert or update of copro_id, bank_account_id, statement_id
on public.compta_bank_transactions
for each row execute function public.compta_check_bank_context();

-- Index utiles pour le contrôle des récurrences et des doublons OCR.
create index if not exists idx_compta_invoices_recurring_match
on public.compta_invoices (copro_id, supplier_id, account_id, amount_total);

create index if not exists idx_compta_invoices_supplier_reference
on public.compta_invoices (copro_id, supplier_id, invoice_number);
