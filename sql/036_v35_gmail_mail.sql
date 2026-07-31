-- WAPI One V35.0 — Gmail Workspace

create table if not exists public.compta_user_mail_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'google',
  mailbox_email text,
  mailbox_name text,
  default_action text not null default 'send'
    check (default_action in ('draft','send')),
  signature_html text,
  last_connected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.compta_user_mail_settings enable row level security;

drop policy if exists "user_read_own_mail_settings" on public.compta_user_mail_settings;
create policy "user_read_own_mail_settings"
  on public.compta_user_mail_settings for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_write_own_mail_settings" on public.compta_user_mail_settings;
create policy "user_write_own_mail_settings"
  on public.compta_user_mail_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.compta_user_mail_settings to authenticated;

alter table if exists public.compta_delivery_logs
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists provider_status text,
  add column if not exists sent_by uuid references auth.users(id) on delete set null;
