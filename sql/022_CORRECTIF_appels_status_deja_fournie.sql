-- ============================================================
-- WAPI One V31.1 - Correctif statut appels
-- Corrige l'erreur : new row for relation "compta_calls" violates check constraint "compta_calls_status_check".
-- Non destructif.
-- ============================================================

begin;

-- Certains anciens schémas n'autorisent pas 'pending' ou 'accounted' dans compta_calls.status.
-- La logique comptable utilise maintenant accounting_status ; status reste un statut fonctionnel plus large.
alter table if exists public.compta_calls
  drop constraint if exists compta_calls_status_check;

alter table if exists public.compta_calls
  add constraint compta_calls_status_check
  check (status in (
    'draft',
    'sent',
    'unpaid',
    'partially_paid',
    'paid',
    'cancelled',
    'pending',
    'accounted'
  ));

-- Normalisation douce : les appels déjà créés avec pending/accounted restent lisibles,
-- mais le logiciel V31.1 utilise surtout accounting_status pour en attente/comptabilisé.
update public.compta_calls
set accounting_status = coalesce(nullif(accounting_status,''),
  case when status='accounted' then 'accounted' when status='pending' then 'pending' else accounting_status end
)
where status in ('pending','accounted') or accounting_status is null or trim(accounting_status)='';

commit;
