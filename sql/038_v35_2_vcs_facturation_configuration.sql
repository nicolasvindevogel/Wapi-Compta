-- WAPI One V35.2
-- VCS belges par personne, emetteurs de facturation et preferences generales.

create sequence if not exists public.wapi_vcs_sequence start with 1 increment by 1;

create or replace function public.wapi_owner_identity_key(
  p_email text, p_name text, p_street text, p_number text, p_postal text, p_city text
) returns text language sql immutable as $$
  select case
    when nullif(lower(trim(coalesce(p_email,''))), '') is not null
      then 'email:' || lower(trim(p_email))
    else 'person:' || regexp_replace(lower(trim(concat_ws('|',p_name,p_street,p_number,p_postal,p_city))), '[^a-z0-9]+', '', 'g')
  end
$$;

create or replace function public.wapi_format_vcs(p_value bigint)
returns text language plpgsql immutable as $$
declare
  base10 text;
  check_value integer;
  digits text;
begin
  base10 := lpad((greatest(p_value,1) % 10000000000)::text, 10, '0');
  check_value := (base10::bigint % 97)::integer;
  if check_value = 0 then check_value := 97; end if;
  digits := base10 || lpad(check_value::text, 2, '0');
  return '+++' || substr(digits,1,3) || '/' || substr(digits,4,4) || '/' || substr(digits,8,5) || '+++';
end $$;

create or replace function public.wapi_vcs_is_valid(p_vcs text)
returns boolean language plpgsql immutable as $$
declare
  d text := regexp_replace(coalesce(p_vcs,''), '[^0-9]', '', 'g');
  expected integer;
begin
  if length(d) <> 12 then return false; end if;
  expected := (substr(d,1,10)::bigint % 97)::integer;
  if expected = 0 then expected := 97; end if;
  return expected = substr(d,11,2)::integer;
exception when others then return false;
end $$;

-- Reconstruit le registre par identite. Une meme personne conserve la meme VCS
-- dans toutes les coproprietes; deux personnes distinctes ne partagent plus la meme VCS.
create or replace function public.wapi_repair_owner_vcs()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  r record;
  candidate text;
  kept_count integer := 0;
  generated_count integer := 0;
begin
  create temporary table if not exists tmp_wapi_vcs_map(
    identity_key text primary key,
    vcs text
  ) on commit drop;
  truncate tmp_wapi_vcs_map;

  insert into tmp_wapi_vcs_map(identity_key, vcs)
  select public.wapi_owner_identity_key(email,display_name,street,street_number,postal_code,city), min(nullif(trim(vcs),''))
  from public.compta_owners
  group by 1;

  -- Une VCS existante n'est conservee que si elle est valide et ne correspond
  -- qu'a une seule identite distincte.
  update tmp_wapi_vcs_map m set vcs=null
  where not public.wapi_vcs_is_valid(m.vcs)
     or exists (
       select 1 from tmp_wapi_vcs_map x
       where x.identity_key<>m.identity_key and x.vcs=m.vcs and x.vcs is not null
     );

  for r in select identity_key, vcs from tmp_wapi_vcs_map order by identity_key loop
    if r.vcs is not null then
      kept_count := kept_count + 1;
      continue;
    end if;
    loop
      candidate := public.wapi_format_vcs(nextval('public.wapi_vcs_sequence'));
      exit when not exists(select 1 from tmp_wapi_vcs_map where vcs=candidate);
    end loop;
    update tmp_wapi_vcs_map set vcs=candidate where identity_key=r.identity_key;
    generated_count := generated_count + 1;
  end loop;

  truncate table public.wapi_owner_vcs_registry;
  insert into public.wapi_owner_vcs_registry(identity_key,vcs)
  select identity_key,vcs from tmp_wapi_vcs_map;

  update public.compta_owners o set vcs=m.vcs
  from tmp_wapi_vcs_map m
  where m.identity_key=public.wapi_owner_identity_key(o.email,o.display_name,o.street,o.street_number,o.postal_code,o.city)
    and o.vcs is distinct from m.vcs;

  return jsonb_build_object('conservees',kept_count,'generees',generated_count,'personnes',kept_count+generated_count);
end $$;

select public.wapi_repair_owner_vcs();

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
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.compta_billing_issuers(code,company_name,invoice_prefix)
values ('WAPI','WAPI SYNDIK','WS'),('DLT','DL TECHNIK','DLT')
on conflict(code) do nothing;

alter table if exists public.compta_syndic_billing_contracts add column if not exists issuer_id uuid references public.compta_billing_issuers(id);
alter table if exists public.compta_syndic_billing_contracts add column if not exists service_family text default 'syndic_fee';
alter table if exists public.compta_syndic_invoices add column if not exists issuer_id uuid references public.compta_billing_issuers(id);

update public.compta_syndic_billing_contracts c set issuer_id=i.id
from public.compta_billing_issuers i where i.code='WAPI' and c.issuer_id is null;
update public.compta_syndic_invoices f set issuer_id=i.id
from public.compta_billing_issuers i where i.code='WAPI' and f.issuer_id is null;

create table if not exists public.compta_app_preferences (
  id boolean primary key default true check(id),
  default_country text not null default 'Belgique',
  currency text not null default 'EUR',
  default_vat_rate numeric(5,2) not null default 21,
  supplier_due_days integer not null default 30,
  call_due_days integer not null default 15,
  require_copro_context boolean not null default true,
  confirm_accounting_actions boolean not null default true,
  pdf_primary_color text default '#5b4bdb',
  document_footer text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.compta_app_preferences(id) values(true) on conflict(id) do nothing;

alter table public.compta_billing_issuers enable row level security;
alter table public.compta_app_preferences enable row level security;
drop policy if exists billing_issuers_authenticated on public.compta_billing_issuers;
create policy billing_issuers_authenticated on public.compta_billing_issuers for all to authenticated using(true) with check(true);
drop policy if exists app_preferences_authenticated on public.compta_app_preferences;
create policy app_preferences_authenticated on public.compta_app_preferences for all to authenticated using(true) with check(true);

grant select,insert,update,delete on public.compta_billing_issuers to authenticated;
grant select,insert,update on public.compta_app_preferences to authenticated;
grant execute on function public.wapi_repair_owner_vcs() to authenticated;

create or replace function public.wapi_next_issuer_invoice_number(p_issuer_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare
  r public.compta_billing_issuers%rowtype;
  result text;
begin
  select * into r from public.compta_billing_issuers where id=p_issuer_id and active=true for update;
  if not found then raise exception 'Emetteur de facturation introuvable ou inactif'; end if;
  if r.numbering_year <> extract(year from current_date)::integer then
    r.numbering_year := extract(year from current_date)::integer;
    r.next_number := 1;
  end if;
  result := r.invoice_prefix || '-' || r.numbering_year || '-' || lpad(r.next_number::text,5,'0');
  update public.compta_billing_issuers
  set numbering_year=r.numbering_year,next_number=r.next_number+1,updated_at=now()
  where id=p_issuer_id;
  return result;
end $$;
grant execute on function public.wapi_next_issuer_invoice_number(uuid) to authenticated;
