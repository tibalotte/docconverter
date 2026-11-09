# Fixtures

Les trois dossiers sont des **fichiers synthétiques** : leur structure imite celle des fichiers d'Assetto Corsa,
mais les valeurs sont inventées. Ils ne proviennent d'aucune voiture réelle (pas de contenu sous licence).

| Dossier | Ce qu'il teste |
|---|---|
| `kunos_simple/` | Style Kunos : CRLF, tabulations, commentaires `;` en fin de ligne, un seul composé. |
| `multi_compounds/` | Trois composés (`FRONT`, `FRONT_1`, `FRONT_2`…), composé par défaut = 1, `tyres.ini` en **Windows-1252** (accents dans un commentaire), essieu avant STRUT. |
| `mod_messy/` | Mod « sale » : fins de ligne LF, BOM UTF-8, casse mixte (`[front]`, `Spring_Rate`), clé dupliquée, commentaires `//`, espaces autour de `=`, pas de saut de ligne final, `[THERMAL_REAR]` absent. |

Régénération : `node fixtures/generate.mjs fixtures`.

**Phase 0 du plan, encore à faire :** ajouter ici des copies de **vrais** dossiers `data` (une voiture Kunos,
une avec plusieurs composés, un mod). Tous les tests d'aller-retour s'appliquent automatiquement à chaque
`*.ini` de chaque sous-dossier.
