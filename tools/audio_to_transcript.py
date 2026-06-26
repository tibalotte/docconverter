#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
audio_to_transcript.py — Script compagnon de DocConverter.

Transforme les audios d'un .pptx (un audio de théorie par diapositive) en un
bundle importable par DocConverter, en RÉUTILISANT les fonctions du pipeline de
l'utilisateur (pipeline_pptx_1.py) :

  1. transcribe_audio  : audio original -> texte brut (Whisper)
  2. reformuler        : texte brut -> script reformulé (moins de mots) + titre
                         + 3 mots-clés (LLM Claude/OpenAI)
  3. generate_tts      : script reformulé -> NOUVELLE voix TTS (l'audio lu
                         correspond exactement au texte affiché -> lecture
                         synchronisée propre)
  4. get_word_timings + build_subtitle_phrases : minutage des phrases
  5. fetch_image       : une image illustrative (Pexels/Pixabay)

Sortie : un dossier (et un .zip) contenant
    transcript.json        (cf. docs/audio-ecoute-active.md)
    media/audio-<n>.mp3     (narration TTS)
    media/image-<n>.<ext>   (image illustrative)

DocConverter importe ce .zip (Module 1 -> « Importer un transcript audio ») et
remplit, par diapositive : transcription, phrases minutées, 3 mots-clés, image,
et l'audio TTS.

PRÉREQUIS : exécuter dans le même environnement que pipeline_pptx_1.py
(mêmes dépendances : whisper, openai/anthropic, pydub, requests…) avec les mêmes
clés API. Ce script n'embarque aucune clé.

Exemple :
    python audio_to_transcript.py cours.pptx \
        --pipeline ./pipeline_pptx_1.py \
        --tts gemini --reformulator anthropic --out ./cours_bundle
"""

import argparse
import importlib.util
import io
import json
import os
import re
import sys
import zipfile
from types import SimpleNamespace


# ─────────────────────────────────────────────────────────────────────────────
# Chargement du module pipeline de l'utilisateur (réutilisation des fonctions)
# ─────────────────────────────────────────────────────────────────────────────
def load_pipeline(path):
    spec = importlib.util.spec_from_file_location('pipeline_pptx_1', path)
    if spec is None:
        sys.exit(f"Impossible de charger le pipeline : {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # sûr : le pipeline garde son code sous if __name__ == '__main__'
    return mod


# ─────────────────────────────────────────────────────────────────────────────
# Extraction des audios du .pptx (un par diapositive), dans l'ordre des slides
# ─────────────────────────────────────────────────────────────────────────────
NS = {
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'rel': 'http://schemas.openxmlformats.org/package/2006/relationships',
}
AUDIO_EXT = {'mp3', 'm4a', 'wav', 'wma', 'aac', 'ogg', 'oga'}


def _resolve(base_dir, target):
    parts = (base_dir + '/' + target).split('/')
    out = []
    for p in parts:
        if p in ('', '.'):
            continue
        if p == '..':
            out.pop()
        else:
            out.append(p)
    return '/'.join(out)


def _slide_order(zf):
    """Ordre des slides via presentation.xml + ses rels (comme DocConverter)."""
    from xml.etree import ElementTree as ET
    pres = ET.fromstring(zf.read('ppt/presentation.xml'))
    rels = ET.fromstring(zf.read('ppt/_rels/presentation.xml.rels'))
    rid_to_target = {}
    for rel in rels.findall('rel:Relationship', NS):
        rid_to_target[rel.get('Id')] = _resolve('ppt', rel.get('Target'))
    order = []
    for sld in pres.findall('.//p:sldIdLst/p:sldId', NS):
        rid = sld.get('{%s}id' % NS['r'])
        if rid in rid_to_target:
            order.append(rid_to_target[rid])
    if not order:
        order = sorted([n for n in zf.namelist()
                        if re.match(r'ppt/slides/slide\d+\.xml$', n)],
                       key=lambda s: int(re.search(r'(\d+)', s).group(1)))
    return order


def extract_slide_audios(pptx_path):
    """Retourne [{'index', 'audio_bytes'|None, 'audio_name'|None, 'notes'}]."""
    from xml.etree import ElementTree as ET
    slides = []
    with zipfile.ZipFile(pptx_path) as zf:
        names = set(zf.namelist())
        for index, slide_path in enumerate(_slide_order(zf)):
            slide_dir = slide_path.rsplit('/', 1)[0]
            rels_path = f"{slide_dir}/_rels/{slide_path.split('/')[-1]}.rels"
            audio_bytes = audio_name = notes = None
            notes_text = ''
            if rels_path in names:
                rels = ET.fromstring(zf.read(rels_path))
                for rel in rels.findall('rel:Relationship', NS):
                    rtype = (rel.get('Type') or '').lower()
                    target = rel.get('Target') or ''
                    ext = target.rsplit('.', 1)[-1].lower() if '.' in target else ''
                    is_audio = 'audio' in rtype or ext in AUDIO_EXT
                    if is_audio and rel.get('TargetMode') != 'External':
                        abs_path = _resolve(slide_dir, target)
                        if abs_path in names:
                            audio_bytes = zf.read(abs_path)
                            audio_name = abs_path.split('/')[-1]
                            break
                    if rtype.endswith('/notesslide') and rel.get('TargetMode') != 'External':
                        np = _resolve(slide_dir, target)
                        if np in names:
                            ndoc = ET.fromstring(zf.read(np))
                            notes_text = ' '.join(
                                t.text or '' for t in ndoc.iter('{%s}t' % NS['p'].replace('presentationml', 'drawingml'))
                            ).strip()
            slides.append({'index': index, 'audio_bytes': audio_bytes,
                           'audio_name': audio_name, 'notes': notes_text})
    return slides


# ─────────────────────────────────────────────────────────────────────────────
# Construction des clients + args minimaux attendus par le pipeline
# ─────────────────────────────────────────────────────────────────────────────
def build_clients(pipe, a):
    import whisper
    print("⏳ Chargement du modèle Whisper (%s)…" % a.whisper_model)
    try:
        import torch
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
    except Exception:
        device = 'cpu'
    whisper_model = whisper.load_model(a.whisper_model, device=device)

    openai_client = anthropic_client = None
    openai_key = pipe.load_api_key(a.openai_key, 'OPENAI_API_KEY', 'OPENAI_API_KEY')
    if openai_key:
        from openai import OpenAI
        openai_client = OpenAI(api_key=openai_key)
    anth_key = pipe.load_api_key(a.anthropic_key, 'ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY')
    if anth_key:
        import anthropic
        anthropic_client = anthropic.Anthropic(api_key=anth_key)

    clients = {
        'openai': openai_client,
        'anthropic': anthropic_client,
        'eleven_key': pipe.load_api_key(a.eleven_key, 'ELEVENLABS_API_KEY', 'ELEVENLABS_API_KEY'),
        'gemini_key': pipe.load_api_key(a.gemini_key, 'GEMINI_API_KEY', 'GEMINI_API_KEY'),
        'pexels_key': pipe.load_api_key(a.pexels_key, 'PEXELS_API_KEY', 'PEXELS_API_KEY'),
        'pixabay_key': pipe.load_api_key(a.pixabay_key, 'PIXABAY_API_KEY', 'PIXABAY_API_KEY'),
    }
    return clients, whisper_model


def pipeline_args(a):
    """Namespace avec les attributs lus par reformuler() et generate_tts()."""
    return SimpleNamespace(
        reformulator=a.reformulator, anthropic_model=a.anthropic_model, gpt_model=a.gpt_model,
        tts=a.tts, speed=a.speed, language=a.language, break_ms=400,
        stability=0.4, similarity=0.8, style=0.5,
        tts_chunking='grouped', sentences_per_group=3, max_chars_per_group=800,
        gemini_max_chunk_chars=600, gemini_min_coverage=0.85, gemini_max_retries=3,
        gemini_delay=8.0, gemini_quota_backoff=3, verbose_tts=False,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Traitement d'un .pptx -> bundle
# ─────────────────────────────────────────────────────────────────────────────
def process(pptx_path, pipe, clients, whisper_model, a):
    pargs = pipeline_args(a)
    slides_audio = extract_slide_audios(pptx_path)
    out_slides = []
    media = {}  # nom_fichier -> bytes
    used_hashes = set()

    for s in slides_audio:
        idx = s['index']
        n = idx + 1
        print(f"\n── Diapositive {n} ──")
        raw_text = ''
        if s['audio_bytes']:
            print("  ⏳ Transcription (Whisper)…")
            raw_text = pipe.transcribe_audio(s['audio_bytes'], s['audio_name'], whisper_model, a.language)
        elif s['notes']:
            raw_text = s['notes']  # repli : notes du présentateur
        if not raw_text.strip():
            print("  (aucun audio ni notes — diapositive ignorée)")
            continue

        # Reformulation -> script court + titre + 3 mots-clés + requête image
        if a.no_reformulation:
            ref = {'script': raw_text, 'title': f"Diapositive {n}", 'keywords': [],
                   'image_query': 'education'}
        else:
            print("  ⏳ Reformulation (LLM)…")
            ref = pipe.reformuler(clients, raw_text, pargs, n)
        script = ref.get('script') or raw_text
        title = ref.get('title') or f"Diapositive {n}"
        keywords = (ref.get('keywords') or [])[:3]
        image_query = ref.get('image_query') or 'education'

        entry = {'index': idx, 'stepId': f"step-{n}", 'title': title,
                 'transcript': script, 'keywords': keywords, 'phrases': []}

        # Narration : TTS du script reformulé (texte affiché == audio entendu)
        audio_for_timing = None
        if not a.no_tts:
            print("  ⏳ Génération TTS…")
            voice = a.voice2 if (a.alternate_voices and n % 2 == 0) else a.voice
            mp3, _info = pipe.generate_tts(clients, script, voice, pargs, whisper_model=whisper_model)
            name = f"audio-{n}.mp3"
            media[name] = mp3
            entry['audioFile'] = f"media/{name}"
            audio_for_timing = mp3
        elif s['audio_bytes']:
            ext = (s['audio_name'].rsplit('.', 1)[-1] if '.' in s['audio_name'] else 'mp3')
            name = f"audio-{n}.{ext}"
            media[name] = s['audio_bytes']
            entry['audioFile'] = f"media/{name}"
            audio_for_timing = s['audio_bytes']
            # En mode --no-tts, le texte affiché doit être la transcription brute
            entry['transcript'] = raw_text

        # Minutage des phrases (mot-à-mot via Whisper sur l'audio de narration)
        if audio_for_timing:
            try:
                print("  ⏳ Minutage des phrases…")
                wt = pipe.get_word_timings(audio_for_timing, whisper_model, a.language)
                entry['phrases'] = pipe.build_subtitle_phrases(entry['transcript'], wt)
            except Exception as exc:
                print(f"  ⚠ minutage ignoré : {exc}")

        # Image illustrative
        if not a.no_image and (clients['pexels_key'] or clients['pixabay_key']):
            print(f"  ⏳ Image « {image_query} »…")
            img_bytes, ext, img_hash, source = pipe.fetch_image(
                image_query, clients['pexels_key'], clients['pixabay_key'], used_hashes)
            if img_bytes:
                if img_hash:
                    used_hashes.add(img_hash)
                ext = (ext or 'jpg').lstrip('.')
                iname = f"image-{n}.{ext}"
                media[iname] = img_bytes
                entry['image'] = f"media/{iname}"
                entry['imageAlt'] = image_query

        out_slides.append(entry)

    return {'schema': 'dc-transcript@1', 'language': a.language, 'slides': out_slides}, media


def write_bundle(out_dir, manifest, media, make_zip=True):
    os.makedirs(os.path.join(out_dir, 'media'), exist_ok=True)
    with open(os.path.join(out_dir, 'transcript.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    for name, data in media.items():
        with open(os.path.join(out_dir, 'media', name), 'wb') as f:
            f.write(data)
    if make_zip:
        zip_path = out_dir.rstrip('/').rstrip('\\') + '.zip'
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.writestr('transcript.json', json.dumps(manifest, ensure_ascii=False, indent=2))
            for name, data in media.items():
                zf.writestr(f"media/{name}", data)
        print(f"\n✅ Bundle : {zip_path}")
        return zip_path
    print(f"\n✅ Bundle : {out_dir}/")
    return out_dir


def main():
    p = argparse.ArgumentParser(description="PPTX audio -> bundle transcript pour DocConverter")
    p.add_argument('pptx', help="Fichier .pptx (un audio de théorie par diapositive)")
    p.add_argument('--pipeline', default='pipeline_pptx_1.py',
                   help="Chemin du module pipeline_pptx_1.py (défaut: ./pipeline_pptx_1.py)")
    p.add_argument('--out', default=None, help="Dossier de sortie (défaut: <pptx>_bundle)")
    # Services / clés (sinon variables d'environnement / .env, comme le pipeline)
    p.add_argument('--openai-key'); p.add_argument('--anthropic-key')
    p.add_argument('--eleven-key'); p.add_argument('--gemini-key')
    p.add_argument('--pexels-key'); p.add_argument('--pixabay-key')
    p.add_argument('--reformulator', default='anthropic', choices=['anthropic', 'openai'])
    p.add_argument('--anthropic-model', default='claude-sonnet-4-6')
    p.add_argument('--gpt-model', default='gpt-4o')
    p.add_argument('--tts', default='gemini', choices=['gemini', 'elevenlabs', 'openai'])
    p.add_argument('--voice', default='Zephyr')
    p.add_argument('--voice2', default='Charon')
    p.add_argument('--alternate-voices', action='store_true', help="Alterner voix 1/2 par diapo")
    p.add_argument('--speed', type=float, default=1.0)
    p.add_argument('--whisper-model', default='medium',
                   choices=['tiny', 'base', 'small', 'medium', 'large', 'large-v2', 'large-v3'])
    p.add_argument('--language', default='fr')
    p.add_argument('--no-tts', action='store_true',
                   help="Ne pas générer de TTS : garder l'audio original + transcription brute")
    p.add_argument('--no-reformulation', action='store_true')
    p.add_argument('--no-image', action='store_true')
    p.add_argument('--no-zip', action='store_true')
    a = p.parse_args()

    pipe = load_pipeline(a.pipeline)
    clients, whisper_model = build_clients(pipe, a)
    out_dir = a.out or (os.path.splitext(a.pptx)[0] + '_bundle')

    manifest, media = process(a.pptx, pipe, clients, whisper_model, a)
    if not manifest['slides']:
        sys.exit("Aucune diapositive avec audio/notes exploitable.")
    write_bundle(out_dir, manifest, media, make_zip=not a.no_zip)
    print(f"   {len(manifest['slides'])} diapositive(s), {len(media)} fichier(s) média.")
    print("   Importe ce .zip dans DocConverter (Module 1 → « Importer un transcript audio »).")


if __name__ == '__main__':
    main()
