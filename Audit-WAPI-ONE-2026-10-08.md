# WAPI ONE — audit et correctifs du 8 octobre 2026

## État de livraison

Les correctifs sont préparés et testés localement, puis déposés sur la branche codex/wapi-one-audit-20261008. Demande de fusion : https://github.com/nicolasvindevogel/Wapi-Compta/pull/1. La demande #1 a été intégrée au commit b92a1cbcd01fff592d9bc7164554cc477ef0dda0. Les deux contrôles GitHub et le déploiement Pages ont réussi. Vérification réelle : exercices accessibles, numéros internes distincts, codes fournisseurs et PDF ouvrant une fenêtre dans la page ; utilisateurs affichés. Un nouveau lot bancaire est préparé séparément.

Source : branche `main` de https://github.com/nicolasvindevogel/Wapi-Compta, commit affiché `5c84ae293ff8fee4ab0eefad5b0e6f54a66e5971`. Archive téléchargée pendant l'audit. `package.json` annonce 37.0.1 ; l'interface publiée affiche V36.10.5 à cause des anciens scripts de version.

WAPI TWO n'a pas été modifié. Aucune migration SQL n'a été exécutée, supprimée ou modifiée. Les corrections ne nécessitent aucune nouvelle migration.

## Défauts et corrections

| Défaut | Preuve / reproduction | Correction locale | Validation |
|---|---|---|---|
| Exercices vides après connexion et changement de copropriété | Sur le site réel, sélection de TEST : sélecteur vide. Console : `Could not embed because more than one relationship was found for 'compta_fiscal_years' and 'compta_copros'`. | Requête directe sur les exercices, sans jointure ambiguë ; noms rattachés localement. Une erreur conserve les exercices déjà chargés. | 6 tests unitaires ; scénario navigateur changement de copropriété/exercice et erreur temporaire. |
| Modules V37 absents de leur emplacement de déploiement | `index.html` demande `js/v37_accounting_core.js` et `js/v37_0_1_fiscal_context_fix.js`, mais ces fichiers n'existent qu'à la racine. | Copies des modules aux chemins réellement chargés. | Test de présence de tous les scripts et styles ; démarrage de la page complète. |
| Commande de tests inutilisable | `npm test` échoue sur `tests/syntax-check.cjs` absent ; tests V37 également rangés à la racine. | Restauration des scripts aux chemins attendus ; copie identique de la migration 057 dans `sql/` pour le test de contrat. | `npm test` passe. |
| CI non installée au bon emplacement | `ci.yml` à la racine ne constitue pas un workflow GitHub Actions. | Workflow placé dans `.github/workflows/` ; ajout de la suite navigateur isolée. | Syntaxe et commandes vérifiées localement ; exécution GitHub Actions encore à confirmer après publication. |
| Estimation annuelle à 13 mensualités | Site réel : contrat de 300 EUR/mois du 01/01/2026 au 31/12/2026 affiché à 3 900 EUR. | Compter les mois calendaires inclus, au lieu d'arrondir une durée en jours puis ajouter un mois. Résultat : 3 600 EUR. | 7 tests : année civile, bissextile, exercice décalé, mois unique, mois partiels, dates inversées et rendu. |
| Utilisateurs affichés à zéro malgré les profils chargés | Site réel : liste vide, alors que les gestionnaires sont proposés dans d'autres écrans. Le gestionnaire de navigation interrompt l'événement avant le rafraîchissement prévu par le module utilisateurs. | Rafraîchissement du module utilisateurs depuis le gestionnaire de navigation effectif. | Test navigateur ciblé et page complète avec un utilisateur fictif. |
| Navigation comptable empêchant le rafraîchissement V37 | Même interruption d'événement pour les écrans grand livre, balance et journaux. | Appeler le rafraîchissement V37 depuis la navigation réelle, lorsque le module est chargé. Le choix du mode serveur reste explicite. | Test navigateur du rafraîchissement. Aucun RPC d'écriture lancé par les tests. |
| Numéros internes affichés répétés et risque de renumérotation au rafraîchissement | Site réel : plusieurs factures affichent le même numéro de remplacement. La requête omet `internal_invoice_number`, puis un ancien traitement considère ces numéros comme manquants. | Charger le numéro enregistré, afficher « — » s'il manque réellement, supprimer le traitement de renumérotation automatique lors de `loadAll`. | Tests du chargement, du rendu et de l'absence d'écriture pendant le rafraîchissement. Les identifiants déjà en base ne sont pas réparés automatiquement. |
| Codes fournisseurs absents dans les factures | Site réel : colonne Code tiers vide. La jointure ne fournit que le nom, et masque la fiche fournisseur complète. | Fusionner la fiche fournisseur déjà chargée avec le nom de la jointure. | Test de rendu du code fournisseur. |
| Boutons PDF absents dans la liste des factures | Site réel : colonne PDF affichant « - », même pour des factures issues du centre de traitement. Le rendu exige le contenu PDF, volontairement exclu de la requête de liste. | Afficher le bouton à partir des métadonnées documentaires ; conserver le chargement du PDF à la demande. | Test de rendu avec `file_name`, sans charger le contenu PDF dans la liste. Le téléchargement réel après publication reste à vérifier. |
| Factures non filtrées par exercice | Reproduit avec deux exercices fictifs : le rendu ne filtre que la copropriété. | Filtrer sur la copropriété et les dates de l'exercice actif ; permettre tous les exercices lorsque la sélection est vide. | Test de rendu avec une facture de l'exercice précédent. |
| Test OCR dépendant d'un PDF extérieur au dépôt | Le test pointe vers un ancien dossier `outputs` qui n'est pas livré avec le dépôt. | Générer une facture PDF fictive dans le test. | Syntaxe vérifiée. Suite OCR intégrale bloquée par le téléchargement PDF.js, voir limites. |

Les URLs des scripts modifiés dans `index.html` ont un nouveau paramètre de cache pour faciliter leur rechargement après publication.

## Tests exécutés

- Contrôle de syntaxe : **34 fichiers JavaScript valides**.
- `npm test` : **74 tests unitaires réussis, zéro échec**.
- `npm run test:ui` : **3 scénarios Playwright réussis, zéro échec**.
- Page complète chargée depuis les vrais fichiers HTML/JS/CSS, avec Supabase simulé : navigation des modules, affichage utilisateurs, passage entre deux copropriétés et deux exercices. Aucun fichier local manquant, aucune exception JavaScript, aucune écriture simulée.
- Suite navigateur historique : scénario budgets réussi (enregistrement brouillon, retour, réouverture, conservation des montants, erreur d'enregistrement). La suite s'arrête ensuite sur le téléchargement externe de PDF.js : **elle n'est pas entièrement validée**.

Les trois nouveaux scénarios navigateur utilisent des données fictives, sans accès à la base réelle. Le test de page complète remplace aussi les bibliothèques externes : il valide le démarrage et la navigation, pas PDF.js, Tesseract ou l'OCR réel.

## Parcours réellement examinés sur le site publié

| Zone | Contrôle effectué | Limite |
|---|---|---|
| Connexion | Écran de connexion puis session ouverte par l'utilisateur. | Déconnexion, expiration et rôles supplémentaires non testés. |
| Copropriété / exercice | Passage du mode global à TEST ; sélection d'exercice impossible, bug reproduit. | Correctif validé localement, pas encore en production. |
| Navigation | Menus principaux et sous-modules parcourus. | Présence d'un écran ne prouve pas la validité de toutes ses opérations. |
| Lots | Liste, propriétaires, quotités et filtres affichés. | Aucune création, mutation ou sauvegarde réelle. |
| Copropriétaires / fournisseurs | Listes et contexte copropriété examinés. | Aucune modification des tiers. |
| Budgets | Liste, montants, statuts et exercice absent. | Écritures testées uniquement dans le scénario isolé historique. |
| Appels | Liste en attente, montants, périodes et lignes affichés. | Aucune génération, comptabilisation ou transmission réelle. |
| Factures | Liste, numéro réel/interne, code fournisseur, paiement et disponibilité PDF. | Aucune création, suppression ou modification réelle. |
| OCR | File, statuts, aperçu et formulaire de contrôle examinés. | Aucun import, ré-analyse ou validation réelle ; OCR intégral non validé. |
| Banque / CODA | Extraits manuels, grand livre financier et file CODA examinés. | Aucun import, rapprochement ou validation réelle. |
| OD | Écran de liste accessible ; aucune OD présente pour TEST. | Création et comptabilisation réelle non testées. |
| Balance | Balance générale et balance tiers affichées. | Totaux affichés non certifiés par comparaison à OptiPro. |
| Grand livre | Grand livre financier affiché ; grand livre général montre un module à structurer dans la version publiée. | Disponibilité du moteur serveur et rapports complets à vérifier après publication. |
| Décomptes | Simulation affichée, exercice non défini et contrôle des centimes visibles. | Aucune validation de clôture ; résultats non certifiés. |
| Facturation syndic | Contrats, montant mensuel et estimation annuelle examinés. | Aucune génération, indexation, export marquant une facture ou comptabilisation déclenchée volontairement. |
| Utilisateurs | Liste vide reproduite et cause de rafraîchissement identifiée. | Création d'accès, changements de rôle et réinitialisations non testés. |
| Documents | Aperçu OCR et modèles d'e-mail examinés ; défaut des boutons PDF identifié. | Téléchargements/PDF de tous les modules et envois non validés. |

## Anomalies de données à contrôler sans réparation automatique

- Plusieurs copropriétaires de TEST affichent une communication VCS identique.
- Des références de factures répétées et des montants voisins apparaissent pour un même fournisseur.
- Des extraits de même numéro et même date apparaissent dans la file CODA.
- Les fournisseurs de TEST ne sont pas associés dans son répertoire, alors que des factures de cette copropriété les utilisent.

Ces observations ne suffisent pas à distinguer des données de test volontairement dupliquées, des erreurs historiques ou un autre défaut du code. Aucun doublon n'a été supprimé et aucune association n'a été créée.

## Prudence sur la production et limites des diagnostics

Aucune action d'écriture, de suppression, de validation, d'envoi ou de clôture n'a été volontairement déclenchée pendant les parcours réels. Cependant, le code initial contient des écritures automatiques au chargement : renumérotation, synchronisation bancaire et facturation récurrente. Il n'est donc pas possible de garantir qu'ouvrir l'ancienne application n'a provoqué aucune écriture interne. La renumérotation automatique a été retirée du correctif ; les autres automatismes existants exigent un environnement isolé pour poursuivre les tests en sécurité.

La console du navigateur a été surveillée ; elle a permis d'identifier l'erreur Supabase des exercices. L'outil de navigateur disponible ne fournit pas la capture exhaustive des requêtes/réponses réseau de cette session authentifiée. Aucun audit réseau complet ni contrôle direct de la base n'est revendiqué.

Le badge de version hérité reste incohérent avec `package.json`. L'absence de fichiers V37 a été corrigée, mais le texte de version de tous les anciens modules n'a pas été harmonisé.

## Application du lot et travail restant

1. Examiner les fichiers de l'archive de correctifs. Elle contient seulement les fichiers ajoutés/modifiés, avec leurs chemins dans le dépôt ; conserver tous les autres fichiers existants.
2. Publier ces changements dans une branche de WAPI ONE et lancer les contrôles. Le workflow restauré exécutera les tests unitaires et les scénarios navigateur isolés.
3. **Ne lancer aucun SQL.** `sql/057_v37_compta_serveur.sql` est une copie byte-identique du fichier déjà présent à la racine, ajoutée uniquement pour restaurer l'organisation attendue par les tests. Son SHA-256 est `9CA6A86CA3B887F4DB34066D1D2D5B16495B30A5AB928F9643FFE7931C33D4F4`.
4. Après validation et déploiement, retester les exercices et les listes sur le site réel, en rechargeant les ressources.
5. Fournir un staging avec données fictives pour terminer les créations/modifications, OCR réel, imports CODA, comptabilisations, clôtures, rôles et documents. Prévoir la comparaison des états comptables avec une référence connue.

Ce rapport décrit un premier lot de stabilisation validé localement. **L'audit fonctionnel complet et la validation après déploiement restent à terminer.**

## Poursuite après confirmation des données de test

Le propriétaire confirme le 8 octobre que tout l’encodage WAPI ONE est du test. Une modification réversible de la référence du lot TEST/A1 a été enregistrée et relue, puis la référence initiale vide a été restaurée. Aucune mutation de propriété ou suppression de lot.

Défaut supplémentaire reproduit : la fiche JEAN affiche une VCS à générer alors que la liste affiche une VCS existante. Le module de fiche lit window.state, alors que l’état applicatif est une variable lexicale. Correction : utiliser appState() pour le type et l’identifiant du tiers, ce qui restaure la lecture de la VCS et de l’adresse structurée. Trois tests supplémentaires couvrent copropriétaire, fournisseur et occupant. Total : 74 tests unitaires et 3 scénarios navigateur réussis.


## Lot bancaire et indicateur d’exercice

Le formulaire Nouvel extrait manuel de TEST propose les copropriétaires de toutes les copropriétés. Correction locale : filtrer propriétaires et occupants selon la copropriété du compte bancaire, filtrer factures/appels à lettrer et refuser un tiers/document d’une autre copropriété avant toute écriture. Les fournisseurs restent globaux. Six tests couvrent le filtrage et l’enregistrement réel sans écriture en cas d’erreur.

EX26 affiche open dans la liste des exercices, mais clôturé dans l’indicateur supérieur en présence d’un ancien closed_at. Correction locale : le statut explicite prévaut pour cet indicateur, avec repli sur closed_at pour les anciens enregistrements sans statut. Quatre tests.

Facture fictive AUDIT-20261008-FACT-01 créée en brouillon, relue (date 08/10/2026, montant 12,34 EUR, compte 650, fournisseur TEST FOUR, numéro interne TEST-EX26-028), puis statut passé à validée. Aucun paiement bancaire réel ni envoi de message.

