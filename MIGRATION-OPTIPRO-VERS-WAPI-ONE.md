# Préparation de la migration Optipro vers WAPI One

## Constat dans Optipro

Optipro ne présente pas un bouton unique permettant d'exporter une copropriété complète. Il propose deux mécanismes de reprise :

- **Import de données** : chargement puis import d'un ensemble de fichiers CSV techniques liés entre eux ;
- **Import structurel CSV** : import plus simple de données de structure, notamment les copropriétaires.

La page de reprise complète observée utilise notamment les fichiers suivants :

`coprbanq.csv`, `coprbudh.csv`, `coprcomp.csv`, `coprctax.csv`, `coprdpen.csv`, `coprfour.csv`, `coprlcom.csv`, `coprlien.csv`, `coprlilo.csv`, `coproana.csv`, `coprocat.csv`, `coprocfo.csv`, `coprociv.csv`, `coprocop.csv`, `coproexr.csv`, `coproged.csv`, `coproimm.csv`, `coproimp.csv`, `coprolot.csv`, `copronat.csv`, `coprosyn.csv`, `coprotel.csv`, `coprplan.csv`, `coprprum.csv`, `coprtant.csv`, `coprtrim.csv`, `coprttel.csv`.

Ces noms montrent qu'une reprise complète est relationnelle : banque, budgets, comptes, fournisseurs, copropriétaires, exercices, documents, immeubles, lots, plan comptable et écritures doivent être importés dans le bon ordre en conservant leurs identifiants de liaison.

## Méthode recommandée

1. Obtenir d'Optipro un export de reprise complet pour une copropriété test, idéalement dans leur format CSV natif.
2. Conserver les fichiers bruts sans les modifier comme archive de migration.
3. Construire dans WAPI One un assistant d'import avec quatre phases :
   - analyse et contrôle des fichiers ;
   - aperçu des données et correspondances ;
   - import dans une zone temporaire ;
   - validation puis intégration définitive dans Supabase.
4. Importer dans cet ordre :
   - copropriété, exercices et plan comptable ;
   - tiers, lots, quotités, clés et liens ;
   - banques, fournisseurs et paramètres ;
   - budgets, appels, factures, écritures et soldes ;
   - documents et archives.
5. Produire automatiquement un rapport de contrôle : nombre de lots, total des quotités, tiers, soldes 410/440, banques, balance débit/crédit et bilan.

## Stratégie de bascule

La voie la plus sûre n'est pas de migrer toutes les copropriétés en une fois. Il faut commencer par une copropriété fictive ou clôturée, comparer Optipro et WAPI One, puis migrer une copropriété active avec un exercice clos et l'exercice courant.

Si Optipro ne fournit pas son export de reprise natif au client, le plan de repli est :

- importer la structure et les tiers par CSV ;
- importer le plan comptable ;
- reprendre les soldes d'ouverture à une date de bascule ;
- importer les factures ouvertes, appels non soldés et soldes bancaires ;
- conserver les anciens exercices et documents en archive PDF/CSV consultable.

Cette seconde méthode est plus simple, mais elle ne permet pas de reconstituer chaque écriture historique dans WAPI One.

## Contrôles obligatoires avant production

- total des quotités par clé ;
- balance débit = crédit ;
- soldes des comptes copropriétaires et fournisseurs ;
- solde de chaque compte bancaire ;
- fonds de roulement et de réserve ;
- factures ouvertes et paiements ;
- solde reporté de chaque copropriétaire ;
- cohérence du bilan avant/après répartition ;
- présence et lisibilité des documents essentiels.

## Prochaine étape technique

Créer un module **Configuration > Migration Optipro** capable de reconnaître automatiquement les fichiers `copr*.csv`, d'afficher les anomalies avant import et de réaliser une simulation sans écrire en production.
