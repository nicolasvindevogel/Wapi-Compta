-- WAPI One V35.8.1
-- Correctif du trigger bancaire lors de la création d'un extrait manuel.
-- La colonne statement_id existe sur compta_bank_transactions, mais pas sur
-- compta_bank_statements. On la lit donc de manière générique via JSONB.

create or replace function public.compta_check_bank_context()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  account_copro uuid;
  statement_copro uuid;
  linked_statement_id uuid;
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

  if tg_table_name = 'compta_bank_transactions' then
    linked_statement_id := nullif(to_jsonb(new)->>'statement_id', '')::uuid;
    if linked_statement_id is not null then
      select copro_id into statement_copro
      from public.compta_bank_statements
      where id = linked_statement_id;

      if statement_copro is null or statement_copro <> new.copro_id then
        raise exception 'L''extrait bancaire ne correspond pas à la copropriété sélectionnée.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- Les triggers existants continuent à appeler la fonction corrigée.
-- On les recrée aussi afin de garantir une installation cohérente.
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

