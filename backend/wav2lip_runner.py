#!/usr/bin/env python3
"""
Wav2Lip runner — chamado pelo backend Node.js
Uso: python3 wav2lip_runner.py <video_path> <audio_path> <output_path>
"""
import sys
import os
import subprocess

def main():
    if len(sys.argv) < 4:
        print("Uso: wav2lip_runner.py <video> <audio> <output>", file=sys.stderr)
        sys.exit(1)

    video_path  = sys.argv[1]
    audio_path  = sys.argv[2]
    output_path = sys.argv[3]

    wav2lip_dir = os.environ.get('WAV2LIP_DIR', '/wav2lip')
    checkpoint  = os.path.join(wav2lip_dir, 'checkpoints', 'wav2lip.pth')
    inference   = os.path.join(wav2lip_dir, 'inference.py')

    if not os.path.exists(checkpoint):
        print(f"Modelo nao encontrado: {checkpoint}", file=sys.stderr)
        sys.exit(1)

    # Usa python do venv do Wav2Lip se disponivel (tem torch instalado)
    # Prioridade: WAV2LIP_PYTHON env > venv dentro do dir > sys.executable
    wav2lip_venv_python = os.path.join(wav2lip_dir, 'venv', 'bin', 'python3')
    if os.environ.get('WAV2LIP_PYTHON') and os.path.exists(os.environ['WAV2LIP_PYTHON']):
        python_bin = os.environ['WAV2LIP_PYTHON']
    elif os.path.exists(wav2lip_venv_python):
        python_bin = wav2lip_venv_python
    else:
        python_bin = sys.executable

    cmd = [
        python_bin, inference,
        '--checkpoint_path', checkpoint,
        '--face', video_path,
        '--audio', audio_path,
        '--outfile', output_path,
        '--noenhance'
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, cwd=wav2lip_dir)

    if result.returncode != 0:
        print(result.stderr or result.stdout, file=sys.stderr)
        sys.exit(result.returncode)

    print(f"OK: {output_path}")

if __name__ == '__main__':
    main()
