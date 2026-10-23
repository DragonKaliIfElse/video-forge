#!/usr/bin/env python3
"""bake_text_behind.py — pré-compõe o efeito "texto atrás do sujeito".

Por que pré-compor em FFmpeg e não mascarar por frame no browser:
  1. 2750 PNGs de máscara em public/ estouram o bundle do Remotion (404).
  2. O FFmpeg 9.0.2 desta máquina descarta alpha no encode VP9
     (`yuva420p` sai como `yuv420p`), então WebM transparente não é confiável.
  3. Pré-composto, o Remotion só faz um <Video> — render muito mais rápido.

Layout correto (o erro clássico é inverter):
  z1  vídeo original (fundo real)
  z2  texto (cor de marca + borda para contraste)
  z3  recorte da pessoa  ← o texto passa atrás dela

ATENÇÃO à máscara: o MediaPipe Selfie Segmenter escreve PESSOA = 0 (preto) e
FUNDO = 255 (branco). O `alphamerge` usa luminância como alpha, então é
obrigatório `negate` antes. Sem isso, o recorte pega a parede e o texto
aparece NA FRENTE da pessoa.

Uso:
    python bake_text_behind.py <public_dir> [--texts "14.6,22.6,MEU CORPO"]
"""
import argparse
import glob
import subprocess
import sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("public_dir", help="diretório com cut.mp4 e mask-cut/")
ap.add_argument("--video", default="cut.mp4")
ap.add_argument("--masks", default="mask-cut")
ap.add_argument("--out", default="text-behind.mp4")
ap.add_argument("--texts", default="14.6,22.6,MEU CORPO",
                help="'inicio,fim,TEXTO' (separe múltiplos com ';')")
ap.add_argument("--font", default=None)
ap.add_argument("--color", default="0x01a6a2", help="cor do texto (default turquesa medido)")
ap.add_argument("--fontsize", type=int, default=118)
ap.add_argument("--y", type=float, default=0.30, help="posição vertical (fração da altura)")
ap.add_argument("--fps", type=int, default=30)
args = ap.parse_args()

PUB = Path(args.public_dir).resolve()
VIDEO = PUB / args.video
MASKS = PUB / args.masks
OUT = PUB / args.out

if not VIDEO.exists():
    print(f"erro: {VIDEO} não existe", file=sys.stderr)
    raise SystemExit(1)
if not MASKS.exists() or not list(MASKS.glob("*.png")):
    print(f"erro: máscaras ausentes em {MASKS}", file=sys.stderr)
    raise SystemExit(1)

# fonte: procura uma bold do sistema
FONT = args.font
if not FONT:
    prefer = [
        "/usr/share/fonts/TTF/InputMonoCompressedExNerdFont-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]
    FONT = next((f for f in prefer if Path(f).exists()), None)
    if not FONT:
        cands = glob.glob("/usr/share/fonts/**/*Bold*.ttf", recursive=True)
        FONT = cands[0] if cands else None
if not FONT:
    print("erro: nenhuma fonte bold encontrada; use --font", file=sys.stderr)
    raise SystemExit(1)

# parse dos textos
texts = []
for chunk in args.texts.split(";"):
    parts = chunk.split(",", 2)
    if len(parts) != 3:
        print(f"erro no formato de --texts: {chunk!r} (esperado 'inicio,fim,TEXTO')",
              file=sys.stderr)
        raise SystemExit(1)
    texts.append((float(parts[0]), float(parts[1]), parts[2]))

W, H = 1280, 720
# tamanho real do vídeo
probe = subprocess.run(
    ["ffprobe", "-v", "error", "-select_streams", "v:0",
     "-show_entries", "stream=width,height", "-of", "csv=p=0", str(VIDEO)],
    capture_output=True, text=True, check=True).stdout.strip().split(",")
W, H = int(probe[0]), int(probe[1])

# máscara: pessoa=0 → negate → alpha (pessoa=255)
fc = (
    f"[1:v]format=gray,scale={W}:{H},negate[m];"
    f"[0:v]format=rgba[fg];"
    f"[fg][m]alphamerge[subject];"
    f"[0:v]format=rgba[bg];"
    + "".join(
        f"[{'bg' if i == 0 else f'stage{i}'}]"
        f"drawtext=fontfile='{FONT}':text='{txt}':fontsize={args.fontsize}:"
        f"fontcolor={args.color}:borderw=3:bordercolor=white:"
        f"x=(w-text_w)/2:y=h*{args.y}:"
        f"enable='between(t,{t0},{t1})'[stage{i + 1}];"
        for i, (t0, t1, txt) in enumerate(texts)
    )
    + f"[stage{len(texts)}][subject]overlay=format=auto,format=yuv420p[out]"
)

print(f"vídeo: {VIDEO.name}  {W}x{H}")
print(f"máscaras: {len(list(MASKS.glob('*.png')))}")
print(f"fonte: {Path(FONT).name}")
print(f"textos: {[t[2] for t in texts]}")

subprocess.run(
    ["ffmpeg", "-y", "-v", "error",
     "-i", str(VIDEO), "-framerate", str(args.fps), "-i", str(MASKS / "%05d.png"),
     "-filter_complex", fc, "-map", "[out]", "-map", "0:a",
     "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
     "-c:a", "copy", "-shortest", str(OUT)],
    check=True,
)
print(f"✓ {OUT.name}  {OUT.stat().st_size / 1024 / 1024:.1f} MB")
