# Audio à écoute active — DocConverter

Beaucoup de diaporamas de FP contiennent **un fichier audio par diapositive**
portant la théorie. Un long audio écouté passivement devient vite ennuyeux. Ce
module transforme l'écoute en **activité** (principe de segmentation de Mayer +
pratique de récupération).

## Dispositifs

| Dispositif | Effet pédagogique |
|------------|-------------------|
| **Transcription synchronisée** | La phrase en cours se surligne pendant la lecture ; clic sur une phrase = saut. Double canal, soutien à la compréhension, **accessibilité**. |
| **Chapitres** | Sections titrées navigables : l'élève contrôle son rythme, se repère. |
| **Points de contrôle** | À un instant donné, l'audio se met en pause et pose une **question** (Module 4). L'élève doit répondre pour continuer → écoute = récupération active. |
| **Vitesse** | 0,75× à 1,5× selon le confort. |

Le bloc `audio` (cf. `docs/schema-json-enrichi.md`) porte :

```jsonc
{
  "type": "audio",
  "content": {
    "mediaRef": "media-3",        // fichier audio extrait du PPTX
    "transcript": "Texte de la théorie…",  // souvent = notes du présentateur
    "phrases": [],                // minutage (vide = estimé automatiquement)
    "chapters":   [ { "title": "Introduction", "start_ms": 0 } ],
    "checkpoints":[ { "at_ms": 45000, "questionRef": "q-2" } ],
    "autoTiming": true
  }
}
```

## D'où vient le texte ?

À l'extraction (Module 1), chaque audio de diapositive devient un bloc `audio`
dont la **transcription est pré-remplie avec les notes du présentateur**. Si
tes notes contiennent déjà le script, c'est immédiat. Sinon, colle le texte
dans l'éditeur (Module 3 → bloc audio).

## Niveaux de synchronisation

1. **Proportionnelle (par défaut, 100 % navigateur).** Le texte est découpé en
   phrases et minuté proportionnellement à la **durée réelle** de l'audio
   (`js/shared/audio-transcript.js`, porté de `_estimate_phrase_durations`).
   Aucune API, aucune étape externe. Surlignage à la phrase.

2. **Mot-à-mot via Whisper (option, étape hors navigateur).** Pour un calage
   précis, un script compagnon (réutilisant `get_word_timings` +
   `build_subtitle_phrases` du pipeline PPTX) peut produire, par audio, un
   tableau `phrases` précis injecté dans `content.phrases`. Dès que ce tableau
   est présent, le lecteur l'utilise tel quel (au lieu de l'estimation).

### Contrat d'import Whisper (à venir)

Le script compagnon devra produire, par bloc audio, un objet :

```json
{ "mediaRef": "media-3",
  "phrases": [ { "text": "…", "start_ms": 0, "end_ms": 2100 }, … ] }
```

…que DocConverter recollera dans `content.phrases` (mapping par `mediaRef`).
Le format est identique à la sortie de `build_subtitle_phrases` (en ms).

## À l'export

Le lecteur tourne **100 % côté client** (HTML5 `<audio>` + `timeupdate`) ; les
fichiers runtime `audio-transcript.js` et `audio-player.js` sont inclus dans le
paquet, l'audio dans `media/`. Compatible Moodle/SCORM et Loi 25 (rien ne sort
du LMS). Les scores des questions de point de contrôle alimentent
`activityComplete` comme les autres.
