# WAPI One V37.0 — cœur comptable serveur

## But

V37 introduit un journal comptable central côté PostgreSQL afin que la balance, le grand livre et les journaux ne dépendent plus des listes partielles chargées dans le navigateur.

WAPI TWO n'est pas modifié. V37 fonctionne en **mode parallèle** : l'ancien moteur V36 continue à faire fonctionner l'application pendant la période de contrôle.

## Ce que crée la migration 057

- `compta_accounting_journals` : ACH, VEN, FIN, OD, AN.
- `compta_accounting_entries` : en-têtes des écritures.
- `compta_accounting_lines` : lignes débit/crédit.
- `compta_accounting_counters` : numérotation atomique par ACP/exercice/journal.
- `compta_accounting_sync_errors` : erreurs de synchronisation non bloquantes.
- RPC de balance, grand livre, journaux, extourne et rapprochement.
- synchronisation automatique des factures, appels comptabilisés et mouvements bancaires.

Une écriture validée devient immuable. Une correction se fait par extourne puis nouvelle écriture.

## Déploiement recommandé

### 1. Sauvegarde

Faire une sauvegarde Supabase avant la migration.

### 2. Exécuter la migration

Exécuter une seule fois :

`sql/057_v37_compta_serveur.sql`

La migration 056 reste dans GitHub même si elle a déjà été exécutée ; elle ne doit pas être supprimée de l'historique.

### 3. Vérifier que le moteur répond

Dans l'éditeur SQL Supabase :

```sql
select public.wapi_v37_capabilities(null, null);
```

Le JSON doit contenir notamment :

```json
{"version":"37.0.0","server_accounting":true,"parallel_mode":true}
```

### 4. Commencer par UNE copropriété et UN exercice

Récupérer les IDs :

```sql
select id, code, name from public.compta_copros order by name;

select id, copro_id, label, starts_on, ends_on, status
from public.compta_fiscal_years
order by starts_on desc;
```

Toujours faire d'abord une simulation :

```sql
select public.wapi_v37_backfill_sources(
  '<COPRO_ID>'::uuid,
  '<FISCAL_YEAR_ID>'::uuid,
  true
);
```

Cette commande ne crée rien. Elle indique combien de factures, appels, mouvements bancaires et groupes OD seront repris.

### 5. Lancer le backfill réel

Seulement après contrôle du dry-run :

```sql
select public.wapi_v37_backfill_sources(
  '<COPRO_ID>'::uuid,
  '<FISCAL_YEAR_ID>'::uuid,
  false
);
```

### 6. Contrôler le rapprochement V36 / V37

```sql
select public.wapi_v37_reconciliation(
  '<COPRO_ID>'::uuid,
  '<FISCAL_YEAR_ID>'::uuid
);
```

Avant de considérer l'exercice comme correctement repris, viser :

- `missing_total = 0`
- `open_sync_errors = 0`
- `balanced = true`
- `ready_for_compare = true`

`ready_for_compare` signifie uniquement que toutes les sources attendues ont une écriture V37 et que le journal est équilibré. Il faut encore comparer les montants avec les états historiques/OptiPro avant une bascule définitive.

## Interface WAPI One

Après migration 057 :

- la Balance affiche un sélecteur **V36 historique / V37 serveur** ;
- la valeur par défaut reste **V36 historique** ;
- le Grand livre, auparavant à structurer, devient un vrai grand livre V37 avec filtres compte/date ;
- les Journaux peuvent être lus depuis PostgreSQL en mode V37 ;
- un badge indique les sources manquantes ou les erreurs de synchronisation.

Le choix V37 est enregistré uniquement dans le navigateur (`localStorage`). Il ne modifie pas WAPI TWO et ne change pas la base métier existante.

## Synchronisation des nouvelles opérations

Après migration :

- nouvelle/modification de facture → synchronisation ACH ;
- appel comptabilisé → synchronisation VEN ;
- mouvement bancaire → synchronisation FIN ;
- OD enregistrée dans WAPI One → réplication vers OD/AN.

Si une synchronisation automatique échoue, la facture/l'appel/le mouvement bancaire reste enregistré dans le moteur existant et l'erreur est ajoutée à `compta_accounting_sync_errors`. C'est volontaire pendant la période de transition.

## Requêtes de contrôle utiles

Erreurs ouvertes :

```sql
select *
from public.compta_accounting_sync_errors
where resolved_at is null
order by created_at desc;
```

Dernières écritures :

```sql
select entry_number, entry_date, journal_code, reference, label, status, source_type, source_id
from public.compta_accounting_entries
where copro_id = '<COPRO_ID>'::uuid
order by entry_date desc, entry_number desc
limit 50;
```

Équilibre global d'un exercice :

```sql
select
  sum(l.debit) as debit,
  sum(l.credit) as credit,
  sum(l.debit-l.credit) as ecart
from public.compta_accounting_entries e
join public.compta_accounting_lines l on l.entry_id=e.id
where e.copro_id='<COPRO_ID>'::uuid
  and e.fiscal_year_id='<FISCAL_YEAR_ID>'::uuid
  and e.status in ('posted','reversed');
```

## Ce qui n'est PAS encore basculé en V37.0

V37.0 est la fondation, pas la fin du chantier comptable. Restent notamment :

1. balance tiers entièrement serveur ;
2. bilan entièrement serveur ;
3. clôture d'exercice et génération des à-nouveaux ;
4. lettrage comptable centralisé ;
5. verrouillage des périodes ;
6. comptes auxiliaires/tier individualisés ;
7. migration des PDF vers Storage ;
8. remplacement progressif des anciens calculs V31/V36 ;
9. tests de non-régression navigateur avec une base de staging ;
10. validation exercice par exercice avec les états OptiPro avant extinction d'OptiPro.

## Règle de transition

Ne pas modifier WAPI TWO pendant cette phase. Les futurs liens ONE ↔ TWO seront préparés seulement au niveau des identifiants et des API, puis activés après abandon d'OptiPro.
