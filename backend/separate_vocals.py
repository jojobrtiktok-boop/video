#!/usr/bin/env python3
"""
Separa vocais do fundo usando Demucs.
Uso: python3 separate_vocals.py <input_audio> <output_dir>
Saída (stdout): dois caminhos, um por linha:
  vocals:<caminho>
  no_vocals:<caminho>
"""
import sys
import os
import subprocess

def main():
    if len(sys.argv) < 3:
        print("Uso: separate_vocals.py <input> <output_dir>", file=sys.stderr)
        sys.exit(1)

    input_file = sys.argv[1]
    output_dir = sys.argv[2]
    os.makedirs(output_dir, exist_ok=True)

    result = subprocess.run(
        [sys.executable, '-m', 'demucs', '--two-stems=vocals', '--mp3', '-o', output_dir, input_file],
        capture_output=True, text=True, timeout=600
    )
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        sys.exit(1)

    basename = os.path.splitext(os.path.basename(input_file))[0]
    # Demucs pode usar htdemucs ou mdx_extra dependendo da versão
    for model_name in ['htdemucs', 'mdx_extra', 'mdx_extra_q']:
        vocals_path    = os.path.join(output_dir, model_name, basename, 'vocals.mp3')
        no_vocals_path = os.path.join(output_dir, model_name, basename, 'no_vocals.mp3')
        if os.path.exists(vocals_path):
            print(f"vocals:{vocals_path}")
            print(f"no_vocals:{no_vocals_path}")
            sys.exit(0)

    print("Arquivo de saída não encontrado após separação.", file=sys.stderr)
    sys.exit(1)

if __name__ == '__main__':
    main()
