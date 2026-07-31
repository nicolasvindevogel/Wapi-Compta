-- WAPI One V35.0 — intégration Outlook / Microsoft Graph

create table if not exists public.compta_mail_provider_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'microsoft'
    check (provider in ('microsoft')),
  tenant_id text not null default 'organizations',
  client_id text,
  redirect_uri text,
  enabled boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_compta_mail_provider
  on public.compta_mail_provider_settings(provider);

create table if not exists public.compta_user_mail_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'microsoft',
  mailbox_email text,
  mailbox_name text,
  default_action text not null default 'draft'
    check (default_action in ('draft','send')),
  signature_html text,
  last_connected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.compta_mail_provider_settings enable row level security;
alter table public.compta_user_mail_settings enable row level security;

drop policy if exists "authenticated_read_mail_provider" on public.compta_mail_provider_settings;
create policy "authenticated_read_mail_provider"
  on public.compta_mail_provider_settings for select to authenticated
  using (true);

drop policy if exists "authenticated_write_mail_provider" on public.compta_mail_provider_settings;
create policy "authenticated_write_mail_provider"
  on public.compta_mail_provider_settings for all to authenticated
  using (
    exists (
      select 1 from public.compta_user_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.active = true
    )
  )
  with check (
    exists (
      select 1 from public.compta_user_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.active = true
    )
  );

drop policy if exists "user_read_own_mail_settings" on public.compta_user_mail_settings;
create policy "user_read_own_mail_settings"
  on public.compta_user_mail_settings for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_write_own_mail_settings" on public.compta_user_mail_settings;
create policy "user_write_own_mail_settings"
  on public.compta_user_mail_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.compta_mail_provider_settings to authenticated;
grant select, insert, update, delete on public.compta_user_mail_settings to authenticated;

alter table if exists public.compta_delivery_logs
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists provider_status text,
  add column if not exists sent_by uuid references auth.users(id) on delete set null;
