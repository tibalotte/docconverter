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

### Script compagnon `tools/audio_to_transcript.py`

Pour la transcription, la reformulation et la voix TTS (qui ne peuvent pas vivre
dans le navigateur), un **script compagnon** réutilise les fonctions du pipeline
PPTX de l'utilisateur (`pipeline_pptx_1.py`) :

1. `transcribe_audio` (Whisper) : audio original → texte brut ;
2. `reformuler` (Claude/OpenAI) : texte brut → **script reformulé (moins de
   mots)** + titre + **3 mots-clés** ;
3. `generate_tts` : script reformulé → **nouvelle voix TTS** (l'audio entendu
   correspond exactement au texte affiché → lecture synchronisée propre) ;
4. `get_word_timings` + `build_subtitle_phrases` : phrases minutées (mot-à-mot) ;
5. `fetch_image` (Pexels/Pixabay) : une **image illustrative**.

Exécution (dans l'environnement du pipeline, avec ses clés API) :

```bash
python tools/audio_to_transcript.py cours.pptx \
    --pipeline ./pipeline_pptx_1.py --tts gemini --reformulator anthropic
# → cours_bundle.zip
```

### Bundle produit et import

Le `.zip` contient `transcript.json` + `media/` :

```json
{ "schema": "dc-transcript@1", "language": "fr",
  "slides": [
    { "index": 0, "stepId": "step-1", "title": "…",
      "transcript": "script reformulé",
      "phrases": [ { "text": "…", "start_ms": 0, "end_ms": 2100 } ],
      "keywords": ["…","…","…"],
      "audioFile": "media/audio-1.mp3", "image": "media/image-1.jpg",
      "imageAlt": "…" } ] }
```

Dans DocConverter : **Module 1 → « Importer un transcript audio (.zip) »**.
L'import enregistre les médias et remplit, par diapositive, le bloc `audio`
(`transcript`, `phrases`, `keywords`, `imageRef`, et l'audio TTS comme
`mediaRef`). Le lecteur affiche alors **l'image + les 3 mots-clés + le texte
synchronisé + le player** — la « page de présentation de la matière » visée.

Le mode `--no-tts` conserve l'audio original et utilise la transcription brute
(non reformulée) pour garantir la correspondance audio/texte.

## À l'export

Le lecteur tourne **100 % côté client** (HTML5 `<audio>` + `timeupdate`) ; les
fichiers runtime `audio-transcript.js` et `audio-player.js` sont inclus dans le
paquet, l'audio dans `media/`. Compatible Moodle/SCORM et Loi 25 (rien ne sort
du LMS). Les scores des questions de point de contrôle alimentent
`activityComplete` comme les autres.
