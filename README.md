# WAPI One

Application de gestion de copropriétés et de comptabilité développée pour WAPI-SYNDIK.

**Version du dépôt : V36.10.6**

## Contenu du dépôt

- `index.html` : point d'entrée de l'application.
- `assets/` : logo et favicon.
- `css/` : feuilles de style réellement conservées par l'application.
- `js/` : code JavaScript de WAPI One.
- `sql/` : historique des migrations Supabase/PostgreSQL.
- `supabase/functions/` : fonctions Edge Supabase.
- `tests/` : contrôles de syntaxe, tests OCR/factures et régressions navigateur.
- `.github/workflows/ci.yml` : contrôles automatiques GitHub Actions.
- `docs/` : audit technique et feuille de route de migration OptiPro -> WAPI One.

## Déploiement GitHub Pages

Le contenu de ce dossier doit être placé à la racine du dépôt GitHub utilisé pour WAPI One.

Ne pas remettre dans le dépôt les anciens doublons de fichiers JS/CSS/SQL à la racine, les dossiers `tmp/`, les rendus de tests, ni les anciens fichiers `LIS-MOI-Vxx` / `CORRECTIFS-Vxx` supprimés lors du nettoyage V36.10.6.

## Supabase

La configuration du navigateur se trouve dans `js/config.js` et ne doit contenir que la configuration publique (`url` et clé `anon/publishable`). Ne jamais y placer de clé `service_role`, mot de passe ou secret OAuth.

Les migrations SQL sont conservées comme historique du schéma. Une migration déjà appliquée ne doit pas être supprimée du dépôt.

**État communiqué au 30/09/2026 :** `sql/056_v36_10_6_integrite_performance.sql` a déjà été exécutée sur la base Supabase de production. Ne pas la réexécuter manuellement sur cette même base sans raison et sans sauvegarde.

## Contrôles avant publication

```bash
npm install
npm test
```

Pour les tests navigateur :

```bash
npx playwright install chromium
npm run test:browser
```

## Sécurité

Ne jamais commiter :

- `.env` ou `.env.*` réels ;
- clé Supabase `service_role` ;
- secrets Gmail/Microsoft ;
- mots de passe ;
- sauvegardes de base contenant des données personnelles ;
- documents réels de copropriétaires ou factures contenant des données sensibles utilisés uniquement pour les tests.

## Documentation

- `docs/AUDIT-WAPI-ONE-2026-09-30.md`
- `docs/MIGRATION-OPTIPRO-VERS-WAPI-ONE.md`
