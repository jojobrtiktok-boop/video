#!/usr/bin/env python3
"""
Gerador de Cenas — renderiza cenas de texto com Pillow + FFmpeg
Uso: python3 gencenas.py <scenes_json_file> <output_mp4> [fps] [width] [height]
"""
import sys, json, os, subprocess, shutil

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def find_font():
    candidates = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
        '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    try:
        r = subprocess.run(['find', '/usr/share/fonts', '-name', '*.ttf', '-iname', '*bold*'],
                           capture_output=True, text=True, timeout=5)
        lines = [l.strip() for l in r.stdout.strip().split('\n') if l.strip()]
        if lines:
            return lines[0]
    except Exception:
        pass
    return None

def wrap_lines(text, draw, font, max_w):
    from PIL import ImageFont
    # Respect explicit \n
    paras = text.replace('\\n', '\n').split('\n')
    result = []
    for para in paras:
        words = para.split()
        cur = []
        for word in words:
            test = ' '.join(cur + [word])
            try:
                w = draw.textlength(test, font=font)
            except Exception:
                w = len(test) * font.size * 0.55
            if w <= max_w or not cur:
                cur.append(word)
            else:
                result.append(' '.join(cur))
                cur = [word]
        if cur:
            result.append(' '.join(cur))
        else:
            result.append('')
    return result

def render_scene_png(scene, W, H, font_path, out_path):
    from PIL import Image, ImageDraw, ImageFont

    bg1 = hex_to_rgb(scene.get('bg_color', '#0a0a1a'))
    bg2_raw = scene.get('bg_color2', None)
    bg2 = hex_to_rgb(bg2_raw) if bg2_raw else tuple(max(0, c - 40) for c in bg1)
    text_color = hex_to_rgb(scene.get('text_color', '#ffffff'))
    font_size = int(scene.get('font_size', 72))
    text = scene.get('text', '').replace('\\n', '\n')
    emoji_str = scene.get('emoji', '')
    stage = scene.get('stage', '')

    # Vertical gradient background
    img = Image.new('RGB', (W, H))
    from PIL import ImageDraw as ID
    draw = ID.Draw(img)
    for y in range(H):
        ratio = y / (H - 1)
        r = int(bg1[0] + (bg2[0] - bg1[0]) * ratio)
        g = int(bg1[1] + (bg2[1] - bg1[1]) * ratio)
        b = int(bg1[2] + (bg2[2] - bg1[2]) * ratio)
        draw.line([(0, y), (W - 1, y)], fill=(r, g, b))

    # Accent bar at top
    accent_raw = scene.get('accent_color', '#7c71ff')
    accent = hex_to_rgb(accent_raw)
    bar_h = max(4, W // 270)
    draw.rectangle([(W // 4, 0), (3 * W // 4, bar_h)], fill=accent)

    # Load font
    try:
        font = ImageFont.truetype(font_path, font_size) if font_path else ImageFont.load_default()
        small_font = ImageFont.truetype(font_path, max(20, font_size // 3)) if font_path else ImageFont.load_default()
    except Exception:
        font = ImageFont.load_default()
        small_font = font

    display_text = text
    if emoji_str:
        display_text = emoji_str + ' ' + text

    max_w = int(W * 0.84)
    lines = wrap_lines(display_text, draw, font, max_w)
    line_h = int(font_size * 1.28)
    total_h = len(lines) * line_h
    y_start = (H - total_h) // 2

    for i, line in enumerate(lines):
        if not line:
            continue
        try:
            tw = int(draw.textlength(line, font=font))
        except Exception:
            tw = len(line) * font_size // 2
        tx = (W - tw) // 2
        ty = y_start + i * line_h

        # Drop shadow (multi-pass for strength)
        for dx, dy in [(-3, -3), (0, 3), (3, 3), (-3, 3), (3, -3), (0, -3)]:
            draw.text((tx + dx, ty + dy), line, font=font, fill=(0, 0, 0))

        # Main text
        draw.text((tx, ty), line, font=font, fill=text_color)

    # Stage label (small, top-left area)
    if stage and stage != 'none':
        stage_label = stage.upper().replace('_', ' ')
        label_y = int(H * 0.08)
        try:
            ltw = int(draw.textlength(stage_label, font=small_font))
        except Exception:
            ltw = len(stage_label) * (font_size // 3) // 2
        lx = (W - ltw) // 2
        # Pill background
        pad = max(8, font_size // 8)
        draw.rounded_rectangle(
            [(lx - pad, label_y - pad // 2), (lx + ltw + pad, label_y + font_size // 3 + pad // 2)],
            radius=max(4, font_size // 12),
            fill=accent
        )
        draw.text((lx, label_y), stage_label, font=small_font, fill=(255, 255, 255))

    img.save(out_path, 'PNG')


def encode_scene(png_path, out_mp4, duration_s, fps):
    fade = min(0.35, duration_s * 0.14)
    fade_out_start = max(0, duration_s - fade)
    cmd = [
        'ffmpeg', '-y', '-loop', '1', '-i', png_path,
        '-vf', (
            f'fade=t=in:st=0:d={fade:.3f},'
            f'fade=t=out:st={fade_out_start:.3f}:d={fade:.3f}'
        ),
        '-t', f'{duration_s:.3f}',
        '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
        '-r', str(fps),
        out_mp4
    ]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError('FFmpeg encode failed: ' + result.stderr.decode()[-300:])


def main():
    if len(sys.argv) < 3:
        print('Usage: gencenas.py <scenes.json> <output.mp4> [fps] [w] [h]', file=sys.stderr)
        sys.exit(1)

    scenes_file = sys.argv[1]
    output_mp4  = sys.argv[2]
    fps  = int(sys.argv[3]) if len(sys.argv) > 3 else 30
    W    = int(sys.argv[4]) if len(sys.argv) > 4 else 1080
    H    = int(sys.argv[5]) if len(sys.argv) > 5 else 1920

    with open(scenes_file, encoding='utf-8') as f:
        scenes = json.load(f)

    font_path = find_font()
    if not font_path:
        print('WARNING: no TTF font found, text may look odd', file=sys.stderr)

    work_dir = output_mp4 + '_work'
    os.makedirs(work_dir, exist_ok=True)

    try:
        scene_clips = []
        for i, scene in enumerate(scenes):
            png_path = os.path.join(work_dir, f's{i}.png')
            clip_mp4 = os.path.join(work_dir, f's{i}.mp4')
            render_scene_png(scene, W, H, font_path, png_path)
            duration_s = max(1.0, float(scene.get('duration_s', 3)))
            encode_scene(png_path, clip_mp4, duration_s, fps)
            scene_clips.append(clip_mp4)
            print(f'PROGRESS:{int((i + 1) / len(scenes) * 85)}', flush=True)

        # Concatenate
        concat_txt = os.path.join(work_dir, 'concat.txt')
        with open(concat_txt, 'w') as f:
            for clip in scene_clips:
                f.write(f"file '{clip}'\n")
        result = subprocess.run(
            ['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', concat_txt, '-c', 'copy', output_mp4],
            capture_output=True
        )
        if result.returncode != 0:
            raise RuntimeError('Concat failed: ' + result.stderr.decode()[-300:])

        print('PROGRESS:100', flush=True)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == '__main__':
    main()
