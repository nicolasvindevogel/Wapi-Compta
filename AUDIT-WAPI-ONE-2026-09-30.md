# Audit WAPI One — 30/09/2026

Version auditée : V36.10.5  
Version de travail corrigée : **V36.10.6**

## 1. Conclusion

WAPI One possède déjà une base fonctionnelle importante : copropriétés, lots, copropriétaires, occupants, fournisseurs, budgets, appels, factures fournisseurs, OCR, banques/CODA, décomptes, assemblées générales, facturation syndic et plusieurs écrans d'administration.

La version actuelle ne doit toutefois **pas encore être considérée comme un remplacement de production complet d'OptiPro**, principalement pour quatre raisons :

1. le moteur comptable reconstitue encore une partie des écritures côté navigateur au lieu de s'appuyer sur un journal comptable serveur unique et irréversible ;
2. certaines données comptables sont chargées avec des limites globales (`100`, `2000`, etc.), ce qui peut rendre un état incomplet lorsque le volume augmente ;
3. plusieurs opérations métier importantes sont constituées de plusieurs requêtes indépendantes et ne sont donc pas atomiques ;
4. la sécurité RLS et la reproductibilité du schéma Supabase doivent encore être renforcées avant une utilisation multi-utilisateur à grande échelle.

Le projet est néanmoins suffisamment avancé pour poursuivre le développement dessus plutôt que repartir de zéro.

---

## 2. Périmètre vérifié

Le dépôt contient environ 170 fichiers dans sa version corrigée. L'application chargée par `index.html` utilise notamment :

- 25 fichiers JavaScript locaux, environ 1,69 Mo non minifiés ;
- 23 feuilles de style locales, environ 194 Ko ;
- `js/app.js` seul représente environ 1,15 Mo ;
- 51 tables `compta_*` sont référencées par le JavaScript ;
- plus de 400 appels `.from(...)` Supabase sont présents dans les scripts chargés ;
- près de 300 écouteurs d'événements sont enregistrés ;
- de nombreuses fonctions sont redéfinies par des couches de correctifs successives (`renderBudgets`, `renderBank`, `renderInvoices`, `saveInvoice`, etc.).

### Tests exécutés

- Contrôle de syntaxe des **32 fichiers JavaScript** du dépôt : **OK**.
- Tests unitaires OCR / extraction facture : **33/33 OK**.
- Contrôle statique HTML : aucun `id` dupliqué et aucune référence locale manquante dans la version corrigée.
- La suite de tests navigateur n'a pas pu être exécutée dans l'environnement d'audit car Playwright n'était pas installé et l'accès réseau ne permettait pas l'installation. Le test a néanmoins été rendu autonome pour la prochaine exécution CI.

---

## 3. Correctifs appliqués dans V36.10.6

### 3.1 Démarrage et performances

- Suppression du double chargement d'une partie importante des référentiels au démarrage.
- Ajout d'une seconde phase de chargement ne récupérant que les données non déjà obtenues lors du boot initial.
- Passage des scripts applicatifs en `defer` afin de ne plus bloquer l'analyse du HTML.
- Chargement asynchrone des bibliothèques lourdes utilisées ponctuellement : JSZip, jsPDF, html2canvas, PDF.js et Tesseract.
- Réduction du contenu récupéré pour la file de validation OCR : le PDF base64 n'est plus chargé une seconde fois avec la file.

### 3.2 Appels de fonds / provisions

Correction d'un problème d'arrondi : auparavant, chaque quote-part était arrondie indépendamment. La somme des appels individuels pouvait donc différer de quelques centimes du montant global.

V36.10.6 utilise une allocation en centimes avec distribution du reliquat :

- somme des lignes propriétaires = montant de l'appel ;
- somme des périodes = montant à répartir ;
- allocation pondérée suivant les quotités avec distribution déterministe des centimes restants.

En cas d'échec de création des lignes après création de l'en-tête d'appel, l'en-tête est maintenant supprimé afin d'éviter un appel partiellement créé.

### 3.3 Factures OCR

- Le JSON OCR enregistré avec la facture ne duplique plus inutilement tout le document `raw_data`.
- En validation simple ou en masse, si la facture est créée puis qu'une étape suivante du workflow échoue, une suppression compensatoire est tentée et la file est marquée en erreur.
- Ajout d'une migration permettant d'empêcher qu'un même `ocr_source_item_id` crée plusieurs factures lorsque les données existantes sont propres.

**À remplacer à terme par une fonction SQL/RPC transactionnelle unique.**

### 3.4 Aperçus PDF

Les URL `blob:` créées pour les aperçus PDF n'étaient pas libérées. Une longue session pouvait accumuler de la mémoire. La version corrigée :

- révoque les anciennes URL ;
- limite le cache d'aperçus ;
- nettoie les URL restantes à la fermeture de la page.

### 3.5 Suppression de factures

La suppression physique d'une facture validée/comptabilisée est maintenant bloquée dans les deux implémentations historiques de `deleteInvoice`. La suppression reste possible pour un brouillon ou un document rejeté.

Pour une facture comptabilisée, le flux cible doit être une **annulation/extourne ou note de crédit**, jamais la disparition de l'écriture source.

### 3.6 Numérotation concurrente

La migration `sql/056_v36_10_6_integrite_performance.sql` ajoute des verrous transactionnels PostgreSQL pour éviter les collisions lors de créations simultanées :

- code copropriétaire ;
- code fournisseur ;
- numéro interne de facture.

### 3.7 Index base de données

La migration 056 ajoute également des index sur plusieurs accès fréquents :

- factures par copropriété/date ;
- opérations bancaires par copropriété/date ;
- écritures par copropriété/date ;
- appels propriétaires par copropriété/échéance ;
- file de validation ;
- imports.

### 3.8 Qualité et CI

Ajout de :

- `.gitignore` ;
- `package.json` ;
- `tests/syntax-check.cjs` ;
- workflow GitHub Actions `.github/workflows/ci.yml` ;
- génération d'un PDF synthétique dans le test navigateur au lieu de dépendre d'un fichier externe absent du dépôt.

---

## 4. Problèmes critiques encore à corriger avant production

### P0-A — Moteur comptable serveur

Le problème le plus important est la fonction de reconstruction comptable côté navigateur. Les écritures de facture, appels et mouvements bancaires sont en partie transformées en lignes comptables au moment de l'affichage.

Il faut créer un **ledger comptable réel** :

- en-tête d'écriture ;
- lignes débit/crédit ;
- journal ;
- numéro séquentiel ;
- copropriété ;
- exercice ;
- date comptable ;
- référence de la pièce justificative ;
- origine métier (`invoice`, `bank`, `call`, `od`, etc.) ;
- utilisateur/date de comptabilisation ;
- statut ;
- lien d'extourne.

Toute comptabilisation doit être réalisée par une fonction serveur transactionnelle. Une écriture validée ne doit plus être modifiée ou supprimée directement ; une correction génère une écriture inverse/rectificative.

### P0-B — États comptables basés sur des données plafonnées

Plusieurs loaders utilisent actuellement des limites globales, notamment :

- factures : environ 2 000 ;
- mouvements bancaires : environ 100 ;
- écritures : environ 2 000 selon la couche active.

Les états comptables utilisent ensuite ces tableaux en mémoire. Quand le portefeuille grossira, une balance ou un décompte pourrait devenir incomplet sans erreur visible.

**Solution :** balance, grand livre, tiers, décompte et situation doivent être calculés côté PostgreSQL/RPC avec filtres obligatoires `copro_id + fiscal_year_id/date range`, jamais sur un snapshot global du navigateur.

### P0-C — Transactions atomiques

Exemples à transformer en RPC transactionnelles :

- facture OCR -> facture -> écriture -> statut OCR ;
- appel -> lignes propriétaires -> écritures ;
- paiement -> rapprochement -> lettrage ;
- OD et modification de ses lignes ;
- clôture d'exercice ;
- mutation de propriétaire avec dates d'effet et répartition.

Le correctif V36.10.6 réduit certains risques avec des rollbacks compensatoires, mais ce n'est pas équivalent à une transaction PostgreSQL.

### P0-D — OD

La sauvegarde d'une OD existante supprime actuellement les lignes avant de recréer les nouvelles. Si l'insertion échoue, l'ancienne écriture peut être perdue.

À remplacer impérativement par `wapi_save_od(...)`, transaction SQL complète, avec validation `SUM(debit) = SUM(credit)` au serveur.

### P0-E — RLS et isolation des données

Plusieurs migrations donnent encore des accès très larges aux utilisateurs `authenticated`, avec des politiques de type `USING (true)` sur certaines tables.

Le filtrage d'une copropriété dans l'interface **n'est pas une sécurité**.

Architecture recommandée :

- administrateur : toutes les ACP ;
- responsable/gestionnaire : uniquement les ACP assignées ;
- comptable : ACP assignées + droits comptables ;
- lecture seule / commissaire : lecture ciblée ;
- futur copropriétaire : exclusivement ses lots, documents autorisés et mouvements concernés.

Chaque politique RLS doit vérifier ces affectations au niveau PostgreSQL.

### P0-F — Schéma Supabase non reproductible

Le JavaScript référence 51 tables `compta_*`, mais les migrations présentes ne contiennent la création de base que d'une petite partie d'entre elles. **42 tables référencées n'ont pas leur `CREATE TABLE` de base dans le dépôt**.

La base distante fonctionne vraisemblablement parce que ces tables existent déjà dans Supabase, mais un nouveau projet ou une restauration complète ne pourrait pas être reconstruit uniquement depuis GitHub.

Il faut générer et versionner un **baseline complet du schéma Supabase** : tables, colonnes, contraintes, FK, index, fonctions, triggers, RLS et policies.

### P0-G — Documents PDF en base64

Les documents OCR sont encore stockés dans `raw_data.file_data_url`. Le base64 augmente la taille, la charge PostgreSQL, le WAL, les sauvegardes et les transferts réseau.

Architecture cible :

- PDF/images -> **Supabase Storage** ;
- table SQL -> `storage_path`, nom, MIME, taille, hash SHA-256, dates, source, version ;
- URL signée courte durée pour consultation ;
- aucune donnée binaire volumineuse dans les requêtes de listes.

### P0-H — Sauvegarde / restauration

Avant bascule réelle :

- stratégie de sauvegarde Supabase ;
- sauvegarde Storage ;
- export indépendant périodique ;
- procédure de restauration documentée ;
- test de restauration réel ;
- journal d'audit des actions sensibles.

---

## 5. Modules présents mais encore déclarés « Module à structurer »

L'interface contient encore explicitement des écrans incomplets pour :

- Bâtiments ;
- Dossiers travaux ;
- Base articles ;
- Facturation électronique ;
- Planificateur ;
- Simulation de répartition ;
- Grand livre ;
- Fonds détenus ;
- Consultation multicopropriété ;
- Agence ;
- Contrôle d'accès ;
- Établissements bancaires ;
- Natures de biens ;
- Codes TVA ;
- Codes journaux ;
- Natures de dépense par défaut ;
- GDPR ;
- Import ;
- Piste d'audit ;
- Isabel Connect.

Ces écrans ne doivent pas être considérés comme terminés uniquement parce qu'ils apparaissent dans le menu.

---

## 6. Fonctions à ajouter pour remplacer réellement OptiPro

### Priorité 1 — coeur syndic/compta

| Module | Cible WAPI One |
|---|---|
| Journal comptable | Partie double serveur, journaux ACH/FIN/OD/VEN, numéros séquentiels, clôtures, extournes |
| Balance / grand livre | Calcul SQL par ACP/exercice, export Excel/PDF, drill-down jusqu'à la pièce |
| Tiers | Lettrage, historique propriétaire/fournisseur, soldes d'ouverture, balance âgée |
| Appels | Budget -> appels -> communication -> encaissement -> lettrage |
| Décomptes | Répartition complète par clés, périodes de propriété/occupation, privatif/commun, chauffage/eau |
| Mutations | vendeur/acquéreur, date d'effet, prorata, fonds, situation notaire, historique |
| Banque | CODA complet, règles de matching, rapprochement, paiements SEPA, rejets |
| Factures | OCR + Peppol, validation, approbation, comptabilisation, paiement, notes de crédit |
| Exercice | ouverture, clôture, verrouillage de période, report à nouveau, contrôles |

### Priorité 2 — gestion opérationnelle

| Module | Cible WAPI One |
|---|---|
| GED | Storage, dossiers, versions, tags, recherche, permissions, liens métier |
| Tickets | demande -> fournisseur -> ordre de service -> relance -> clôture |
| Sinistres | police, déclaration, expert, pièces, indemnisation, franchise, travaux |
| Contrats | fournisseur, périodicité, échéance, indexation, rappel, document |
| AG | convocations, procurations, présences, quorum, majorités, votes, PV, suivi décisions |
| Relances | scénarios 1/2/3, frais, intérêts, historique, recommandé, avocat/huissier |
| Communication | e-mails liés à ACP/lot/tiers/dossier, modèles, historique, pièces |
| Portail copropriétaire | documents, compte, appels, décomptes, AG, tickets, coordonnées |

### Priorité 3 — automatisation et pilotage

| Module | Cible WAPI One |
|---|---|
| Dashboard portefeuille | impayés, trésorerie, factures, incidents, AG, contrats, anomalies |
| Workflow | tâches et validations configurables par type de dossier |
| Planificateur | contrôles, entretiens, contrats, AG, échéances récurrentes |
| Notifications | e-mail/SMS/push selon événements et préférences |
| API/Webhooks | Peppol, banque, mail, portail, outils externes |
| Recherche globale | copro, lot, personne, facture, montant, document, ticket |
| Audit | qui/quand/avant/après/IP/session pour toutes actions sensibles |

---

## 7. Peppol / facturation électronique

Le module « Facturation électronique » de WAPI One est encore un placeholder.

Depuis le 1er janvier 2026, la Belgique impose la facture électronique structurée pour la plupart des opérations B2B entre assujettis TVA belges entrant dans le champ de l'obligation. WAPI One doit donc pouvoir, selon les opérations concernées :

- envoyer et recevoir des documents structurés ;
- conserver le document structuré original ;
- produire une représentation lisible ;
- gérer Peppol-BIS / EN16931 ;
- gérer les statuts d'envoi/réception/rejet ;
- rapprocher automatiquement une facture Peppol d'un fournisseur et d'une ACP ;
- conserver les pièces jointes et preuves de traitement.

Recommandation : intégrer un **prestataire Access Point Peppol via API**, plutôt que développer un Access Point complet en interne.

---

## 8. Architecture recommandée

Le principal refactoring recommandé est de passer progressivement de :

`index.html -> app.js géant -> state navigateur -> nombreuses requêtes Supabase directes`

à :

`UI modulaire -> services métier -> RPC/API transactionnelles -> PostgreSQL + Storage`

Structure cible possible :

```text
src/
  core/
    supabase.js
    auth.js
    permissions.js
    router.js
  modules/
    accounting/
    banking/
    invoices/
    owners/
    lots/
    calls/
    settlements/
    assemblies/
    tickets/
    claims/
    documents/
    syndic-billing/
  shared/
    dates.js
    money.js
    pdf.js
    validation.js
  ui/
```

Chaque module doit exposer ses fonctions sans écraser des fonctions globales d'une version précédente.

---

## 9. Dette technique à réduire

`app.js` dépasse 1,1 Mo et le projet utilise une succession de fichiers `v33`, `v34`, `v35`, `v36` qui redéfinissent fréquemment les mêmes fonctions. Cette technique a permis d'avancer rapidement sans casser les anciennes versions, mais elle devient maintenant une source de :

- difficulté à savoir quelle fonction est réellement active ;
- bugs de chargement suivant l'ordre des scripts ;
- duplication de logique ;
- tests difficiles ;
- ralentissement du chargement ;
- corrections qui peuvent en annuler d'autres.

La prochaine phase doit commencer à **fusionner les versions actives** module par module, avec Git pour conserver l'historique au lieu de conserver toutes les anciennes implémentations dans le runtime.

---

## 10. Ordre conseillé de développement

1. Baseline Supabase complet + sauvegarde/restauration.
2. Matrice de rôles et RLS stricte.
3. Ledger comptable serveur + transactions + verrouillage des périodes.
4. Balance, grand livre, tiers et décomptes alimentés uniquement par ce ledger.
5. Migration PDF/OCR vers Storage.
6. Factures fournisseurs transactionnelles + Peppol.
7. Banque/CODA/SEPA/lettrage serveur.
8. Mutations et prorata complets.
9. GED, tickets, sinistres, contrats et relances.
10. AG complète et portail copropriétaire.
11. Refactoring du monolithe JS et suppression des couches versionnées obsolètes.
12. Tests E2E systématiques + staging + plan de migration OptiPro.

---

## 11. Mise en place de V36.10.6

### Code

Le ZIP corrigé peut remplacer la branche de développement actuelle après revue Git.

### SQL

La migration suivante est nouvelle :

`sql/056_v36_10_6_integrite_performance.sql`

**Ne pas l'exécuter directement sur la production sans sauvegarde et test sur une base de staging.** Elle est conçue pour être non destructive, mais la base distante n'a pas été accessible pendant cet audit.

### Tests

Depuis la racine du projet :

```bash
npm install
npm test
npm run test:browser
```

Le workflow GitHub Actions exécutera `npm test` à chaque push/PR. Une seconde étape CI avec navigateur pourra être ajoutée après validation de Playwright dans GitHub Actions.

---

## 12. Verdict de l'audit

**Base fonctionnelle : bonne et exploitable pour continuer le développement.**  
**Utilisation pilote interne : envisageable après staging, sauvegardes et durcissement RLS.**  
**Remplacement complet d'OptiPro pour la comptabilité de production : pas encore.**

Le chemin le plus efficace n'est plus d'ajouter des écrans : il faut maintenant fiabiliser le coeur (ledger, transactions, sécurité, stockage documentaire et schéma reproductible), puis terminer les modules opérationnels autour de ce coeur.
