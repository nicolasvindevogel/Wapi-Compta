-- WAPI One V36 — centre de traitement des factures.
-- La migration 045 doit être exécutée avant celle-ci.

alter table if exists public.compta_validation_queue
  add column if not exists workflow_bucket text,
  add column if not exists processing_error text,
  add column if not exists duplicate_of uuid references public.compta_validation_queue(id) on delete set null,
  add column if not exists last_analysis_at timestamptz,
  add column if not exists analysis_attempts integer not null default 0;

update public.compta_validation_queue
set workflow_bucket = case
  when status = 'validated' then 'posted'
  when status = 'rejected' then 'rejected'
  when status = 'to_validate' then 'to_validate'
  else 'to_process'
end
where workflow_bucket is null;

create index if not exists idx_validation_queue_workflow_bucket
  on public.compta_validation_queue(workflow_bucket);
create index if not exists idx_validation_queue_copro_bucket
  on public.compta_validation_queue(copro_id, workflow_bucket);

grant select, insert, update, delete on public.compta_validation_queue to authenticated;

