-- WAPI One V35.4.1 - conversion définitive des codes tiers en texte

drop trigger if exists trg_wapi_set_supplier_code on public.compta_suppliers;
drop trigger if exists trg_wapi_set_owner_code on public.compta_owners;

alter table public.compta_suppliers
  alter column code drop default,
  alter column supplier_code drop default;
alter table public.compta_owners
  alter column code drop default,
  alter column owner_code drop default;

alter table public.compta_suppliers
  alter column code type text using code::text,
  alter column supplier_code type text using supplier_code::text;

alter table public.compta_owners
  alter column code type text using code::text,
  alter column owner_code type text using owner_code::text;

-- Conserver en priorité les codes lisibles qui existaient déjà.
update public.compta_suppliers
set code=supplier_code
where supplier_code ~ '^F-[0-9]+$'
  and code is distinct from supplier_code;

update public.compta_owners
set code=owner_code
where owner_code ~ '^C-[0-9]+$'
  and code is distinct from owner_code;

-- Normaliser les anciens codes purement numériques sans toucher aux codes valides.
update public.compta_suppliers
set code='F-' || lpad(regexp_replace(coalesce(code,supplier_code,'0'),'[^0-9]','','g'),4,'0')
where coalesce(code,'') !~ '^F-[0-9]+$'
  and nullif(regexp_replace(coalesce(code,supplier_code,''),'[^0-9]','','g'),'') is not null;

update public.compta_owners
set code='C-' || lpad(regexp_replace(coalesce(code,owner_code,'0'),'[^0-9]','','g'),4,'0')
where coalesce(code,'') !~ '^C-[0-9]+$'
  and nullif(regexp_replace(coalesce(code,owner_code,''),'[^0-9]','','g'),'') is not null;

-- Attribuer un code aux rares lignes qui n'en ont toujours pas.
with base as (
  select coalesce(max(nullif(regexp_replace(code,'[^0-9]','','g'),'')::integer),0) as n
  from public.compta_suppliers where code ~ '^F-[0-9]+$'
), missing as (
  select id,(select n from base)+row_number() over(order by coalesce(created_at,now()),name,id) as n
  from public.compta_suppliers where coalesce(code,'') !~ '^F-[0-9]+$'
)
update public.compta_suppliers s
set code='F-'||lpad(m.n::text,4,'0')
from missing m where s.id=m.id;

with base as (
  select coalesce(max(nullif(regexp_replace(code,'[^0-9]','','g'),'')::integer),0) as n
  from public.compta_owners where code ~ '^C-[0-9]+$'
), missing as (
  select id,(select n from base)+row_number() over(order by coalesce(created_at,now()),display_name,id) as n
  from public.compta_owners where coalesce(code,'') !~ '^C-[0-9]+$'
)
update public.compta_owners o
set code='C-'||lpad(m.n::text,4,'0')
from missing m where o.id=m.id;

update public.compta_suppliers set supplier_code=code where supplier_code is distinct from code;
update public.compta_owners set owner_code=code where owner_code is distinct from code;

create or replace function public.wapi_next_supplier_code()
returns text language plpgsql as $$
declare n integer;
begin
  select coalesce(max(nullif(regexp_replace(coalesce(supplier_code,code),'[^0-9]','','g'),'')::integer),0)+1
  into n from public.compta_suppliers
  where coalesce(supplier_code,code) ~ '^F-[0-9]+$';
  return 'F-'||lpad(n::text,4,'0');
end $$;

create or replace function public.wapi_next_owner_code()
returns text language plpgsql as $$
declare n integer;
begin
  select coalesce(max(nullif(regexp_replace(coalesce(owner_code,code),'[^0-9]','','g'),'')::integer),0)+1
  into n from public.compta_owners
  where coalesce(owner_code,code) ~ '^C-[0-9]+$';
  return 'C-'||lpad(n::text,4,'0');
end $$;

create or replace function public.wapi_set_supplier_code()
returns trigger language plpgsql as $$
begin
  if nullif(trim(new.supplier_code),'') is null and nullif(trim(new.code),'') is null then
    new.supplier_code:=public.wapi_next_supplier_code();
    new.code:=new.supplier_code;
  elsif nullif(trim(new.supplier_code),'') is null then
    new.supplier_code:=new.code;
  elsif nullif(trim(new.code),'') is null then
    new.code:=new.supplier_code;
  end if;
  return new;
end $$;

create or replace function public.wapi_set_owner_code()
returns trigger language plpgsql as $$
begin
  if nullif(trim(new.owner_code),'') is null and nullif(trim(new.code),'') is null then
    new.owner_code:=public.wapi_next_owner_code();
    new.code:=new.owner_code;
  elsif nullif(trim(new.owner_code),'') is null then
    new.owner_code:=new.code;
  elsif nullif(trim(new.code),'') is null then
    new.code:=new.owner_code;
  end if;
  return new;
end $$;

create trigger trg_wapi_set_supplier_code
before insert on public.compta_suppliers
for each row execute function public.wapi_set_supplier_code();

create trigger trg_wapi_set_owner_code
before insert on public.compta_owners
for each row execute function public.wapi_set_owner_code();

create unique index if not exists compta_suppliers_code_unique_idx
  on public.compta_suppliers(code) where code is not null;
create unique index if not exists compta_owners_code_unique_idx
  on public.compta_owners(code) where code is not null;

notify pgrst, 'reload schema';
