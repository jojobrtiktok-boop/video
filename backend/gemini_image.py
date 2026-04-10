#!/usr/bin/env python3
"""
Gemini Image Generation/Editing via Google Generative AI API
Uso: python3 gemini_image.py <mode> <api_key> <prompt> <output_path> [image_path]

Modes:
  create    - text to image
  translate - translate text inside image to PT-BR
  vary      - vary creative based on image + prompt
  remix     - remix/edit image based on instruction
"""
import sys, os, json, base64, requests
from pathlib import Path

def usage():
    print(json.dumps({"error": "Uso: gemini_image.py <mode> <api_key> <prompt> <output_path> [image_path]"}))
    sys.exit(1)

if len(sys.argv) < 5:
    usage()

mode        = sys.argv[1]
api_key     = sys.argv[2]
prompt      = sys.argv[3]
output_path = sys.argv[4]
image_path  = sys.argv[5] if len(sys.argv) > 5 else None

MODEL = 'gemini-2.0-flash-exp'
URL   = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={api_key}'

def img_to_b64(path):
    ext = Path(path).suffix.lower().lstrip('.')
    mime_map = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp', 'gif': 'image/gif'}
    mime = mime_map.get(ext, 'image/jpeg')
    with open(path, 'rb') as f:
        data = f.read()
    return base64.b64encode(data).decode(), mime

def call_gemini(parts):
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]}
    }
    r = requests.post(URL, json=payload, timeout=120)
    data = r.json()
    if 'error' in data:
        err = data['error']
        raise Exception(err.get('message', str(err)))
    candidates = data.get('candidates', [])
    if not candidates:
        raise Exception('Gemini não retornou candidatos. Resposta: ' + json.dumps(data)[:300])
    out_parts = candidates[0].get('content', {}).get('parts', [])
    # Find the image part
    for p in out_parts:
        if 'inline_data' in p:
            img_bytes = base64.b64decode(p['inline_data']['data'])
            # Save to output
            os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
            with open(output_path, 'wb') as f:
                f.write(img_bytes)
            # Also collect any text description
            desc = next((p2.get('text','') for p2 in out_parts if 'text' in p2), '')
            return True, desc
    # No image in response — model may have refused or only returned text
    text_resp = ' '.join(p.get('text','') for p in out_parts if 'text' in p)
    raise Exception('Nenhuma imagem na resposta. Resposta do modelo: ' + (text_resp[:300] if text_resp else 'vazia'))

# ── Build parts based on mode ──────────────────────────────────────────────

parts = []

if mode == 'create':
    # Pure text-to-image
    parts.append({"text": prompt if prompt else "Gere uma imagem criativa"})

elif mode == 'translate':
    if not image_path or not os.path.exists(image_path):
        raise Exception('image_path obrigatório para modo translate')
    b64, mime = img_to_b64(image_path)
    target_lang = prompt if prompt else 'Português do Brasil'
    parts.append({"text": (
        f"Traduza TODO o texto visível nesta imagem para {target_lang}. "
        "Mantenha exatamente o mesmo layout, posição, cores de fundo, estilo tipográfico e design da imagem original. "
        "Substitua apenas os textos pelo equivalente traduzido, sem alterar outros elementos visuais."
    )})
    parts.append({"inline_data": {"mime_type": mime, "data": b64}})

elif mode == 'vary':
    if not image_path or not os.path.exists(image_path):
        raise Exception('image_path obrigatório para modo vary')
    b64, mime = img_to_b64(image_path)
    instr = prompt if prompt else 'Crie uma variação criativa mantendo o tema principal'
    parts.append({"text": (
        f"Com base nessa imagem de referência, crie uma NOVA variação criativa seguindo a instrução: {instr}. "
        "Mantenha a identidade visual, paleta de cores e estrutura geral, mas varie conforme pedido."
    )})
    parts.append({"inline_data": {"mime_type": mime, "data": b64}})

elif mode == 'remix':
    if not image_path or not os.path.exists(image_path):
        raise Exception('image_path obrigatório para modo remix')
    b64, mime = img_to_b64(image_path)
    instr = prompt if prompt else 'Melhore esta imagem'
    parts.append({"text": (
        f"Edite esta imagem conforme a instrução: {instr}. "
        "Preserve tudo que não foi mencionado na instrução."
    )})
    parts.append({"inline_data": {"mime_type": mime, "data": b64}})

else:
    raise Exception(f'Modo desconhecido: {mode}')

try:
    ok, desc = call_gemini(parts)
    print(json.dumps({"ok": True, "description": desc}))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
    sys.exit(1)
