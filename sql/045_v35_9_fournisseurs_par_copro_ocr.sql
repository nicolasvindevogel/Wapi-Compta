-- WAPI One V35.9 — fournisseurs globaux, activés copropriété par copropriété.

create table if not exists public.compta_copro_suppliers (
  id uuid primary key default gen_random_uuid(),
  copro_id uuid not null references public.compta_copros(id) on delete cascade,
  supplier_id uuid not null references public.compta_suppliers(id) on delete cascade,
  active boolean not null default true,
  source text not null default 'manual' check (source in ('manual','invoice','ocr','profile','migration')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (copro_id, supplier_id)
);

create index if not exists idx_compta_copro_suppliers_copro
  on public.compta_copro_suppliers(copro_id) where active = true;
create index if not exists idx_compta_copro_suppliers_supplier
  on public.compta_copro_suppliers(supplier_id) where active = true;

-- Reprend les associations déjà prouvées par l'historique, sans dupliquer le fournisseur.
insert into public.compta_copro_suppliers(copro_id, supplier_id, source)
select distinct i.copro_id, i.supplier_id, 'migration'
from public.compta_invoices i
where i.copro_id is not null and i.supplier_id is not null
on conflict (copro_id, supplier_id) do update set active = true, updated_at = now();

insert into public.compta_copro_suppliers(copro_id, supplier_id, source)
select distinct p.copro_id, p.supplier_id, 'profile'
from public.compta_supply_profiles p
where p.copro_id is not null and p.supplier_id is not null
on conflict (copro_id, supplier_id) do update set active = true, updated_at = now();

-- Compatibilité avec les anciennes fiches fournisseur qui possédaient un copro_id.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'compta_suppliers' and column_name = 'copro_id'
  ) then
    execute $sql$
      insert into public.compta_copro_suppliers(copro_id, supplier_id, source)
      select distinct s.copro_id, s.id, 'migration'
      from public.compta_suppliers s
      where s.copro_id is not null
      on conflict (copro_id, supplier_id) do update set active = true, updated_at = now()
    $sql$;
  end if;
end $$;

-- Toute facture validée prouve que le fournisseur appartient à la copropriété.
create or replace function public.wapi_link_invoice_supplier_to_copro()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.copro_id is not null and new.supplier_id is not null then
    insert into public.compta_copro_suppliers(copro_id, supplier_id, active, source, created_by)
    values (new.copro_id, new.supplier_id, true,
      case when coalesce(new.source, '') in ('processing_center','ocr','email') then 'ocr' else 'invoice' end,
      auth.uid())
    on conflict (copro_id, supplier_id)
    do update set active = true, updated_at = now();
  end if;
  return new;
end $$;

drop trigger if exists trg_wapi_link_invoice_supplier_to_copro on public.compta_invoices;
create trigger trg_wapi_link_invoice_supplier_to_copro
after insert or update of copro_id, supplier_id on public.compta_invoices
for each row execute function public.wapi_link_invoice_supplier_to_copro();

alter table public.compta_copro_suppliers enable row level security;
drop policy if exists "authenticated_read_copro_suppliers" on public.compta_copro_suppliers;
create policy "authenticated_read_copro_suppliers" on public.compta_copro_suppliers
for select to authenticated using (true);
drop policy if exists "authenticated_write_copro_suppliers" on public.compta_copro_suppliers;
create policy "authenticated_write_copro_suppliers" on public.compta_copro_suppliers
for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.compta_copro_suppliers to authenticated;

